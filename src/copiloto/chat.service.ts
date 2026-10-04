import { HttpException, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import type { Response } from 'express';
import { AuthUser } from '../auth/current-user.decorator';
import { AiClient, CopilotoTurno, TurnoInterrompido } from '../clients/ai.client';
import { CotaTokensEsgotada, MENSAGEM_COTA_ESGOTADA } from '../cota/cota-tokens.service';
import { ConversaCopilotoDoc, MensagemCopiloto } from '../mongo/mongo.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { semContato } from '../perfil/perfil.normalizacao';
import { descreverParaAgente, toolDependeDoPipeline } from '../pipeline-ats/maquina';
import { PipelineAtsService } from '../pipeline-ats/pipeline-ats.service';
import { ConversasService } from './conversas.service';
import { ChatDto } from './copiloto.dto';
import { BlocoNativo, paraTrocas, resultadoTool } from './historico';
import { oportunidadeDosArgs, prepararArgsTool } from './tool-args';
import { ToolExecutor, validarArgs } from './tool-executor';
import { ToolDef, TOOLS_NATIVAS, TOOLS_POR_NOME } from './tools';

const MAX_PASSOS = 8;
const ESCRITAS_SEM_CONFIRMACAO_NO_AUTOPILOTO = new Set(['registrar_nota']);

type ToolUse = Extract<BlocoNativo, { type: 'tool_use' }>;

interface ResultadoRegistrado {
  callId: string;
  tool: string;
  efeito: ToolDef['efeito'];
  args: Record<string, unknown>;
  ok: boolean;
  resultado?: unknown;
  erro?: string;
}

export function exigeConfirmacao(tool: ToolDef, modo: 'assistido' | 'autopiloto'): boolean {
  if (tool.efeito !== 'escrita') return false;
  if (modo === 'assistido') return true;
  return !ESCRITAS_SEM_CONFIRMACAO_NO_AUTOPILOTO.has(tool.nome);
}

@Injectable()
export class ChatService {
  constructor(
    private readonly conversas: ConversasService,
    private readonly ai: AiClient,
    private readonly executor: ToolExecutor,
    private readonly oportunidades: OportunidadesService,
    private readonly pipelineAts: PipelineAtsService,
  ) {}

  async chat(
    res: Response,
    user: AuthUser,
    dto: ChatDto,
  ): Promise<void> {
    if (dto.oportunidadeId) {
      await this.oportunidades.garantirVaga(user.userId, dto.oportunidadeId);
    }
    const modo = dto.modo ?? 'assistido';
    const conversa = await this.conversas.abrir(
      user.userId,
      dto.conversaId,
      modo,
      dto.oportunidadeId ?? null,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      if (dto.confirmacao) {
        const seguir = await this.resolverConfirmacao(res, conversa, dto);
        if (!seguir) return;
      } else if (dto.mensagem) {
        if (conversa.pendencia) {
          await this.conversas.definirPendencia(conversa._id, null);
          conversa.pendencia = null;
        }
        await this.registrar(conversa, { papel: 'user', conteudo: dto.mensagem });
      }

      await this.laco(res, conversa, modo);
    } catch (err) {
      await this.registrarErro(conversa, 'interno', this.mensagemErro(err));
      this.enviar(res, 'erro', {
        escopo: 'interno',
        mensagem: this.mensagemErro(err),
        recuperavel: true,
      });
      this.finalizar(res, conversa._id, 'erro');
    }
  }

  private async resolverConfirmacao(
    res: Response,
    conversa: ConversaCopilotoDoc,
    dto: ChatDto,
  ): Promise<boolean> {
    const pend = conversa.pendencia;
    const confirmacao = dto.confirmacao!;
    if (!pend || pend.callId !== confirmacao.callId) {
      await this.registrarErro(conversa, 'interno', 'nao ha confirmacao pendente para este passo');
      this.enviar(res, 'erro', {
        escopo: 'interno',
        mensagem: 'nao ha confirmacao pendente para este passo',
        recuperavel: true,
      });
      this.finalizar(res, conversa._id, 'erro');
      return false;
    }

    const pendencia = await this.conversas.confirmarPendencia(conversa._id, confirmacao.callId);
    if (!pendencia) {
      const anterior = await this.conversas.buscarConfirmacao(conversa._id, confirmacao.callId);
      if (anterior) {
        this.enviar(res, 'tool_resultado', { callId: anterior.callId, tool: anterior.tool, ok: !anterior.erro, resultado: anterior.resultado ?? null, erro: anterior.erro ? { mensagem: anterior.erro, recuperavel: true } : null });
        this.finalizar(res, conversa._id, anterior.erro ? 'erro' : 'completo');
        return false;
      }
      this.enviar(res, 'erro', { escopo: 'interno', mensagem: 'este passo ja esta em execucao; consulte o status antes de repetir', recuperavel: true });
      this.finalizar(res, conversa._id, 'erro');
      return false;
    }
    conversa.pendencia = pendencia;

    if (confirmacao.decisao === 'recusar') {
      await this.conversas.definirPendencia(conversa._id, null);
      if (pend.tool === 'gerar_curriculo') await this.recusarGeracao(conversa, pend.args);
      await this.conversas.registrarConfirmacao(conversa._id, { callId: pend.callId, tool: pend.tool, decisao: 'recusar', concluidaEm: new Date() });
      await this.registrar(conversa, {
        papel: 'tool',
        tool: pend.tool,
        conteudo: 'o candidato recusou esta escrita; nao repita',
        blocos: [resultadoTool(pend.callId, 'o candidato recusou esta escrita; nao repita', true)],
        dados: { callId: pend.callId, efeito: 'escrita', args: pend.args, ok: false, erro: 'recusada pelo candidato' },
      });
      return true;
    }

    const tool = TOOLS_POR_NOME.get(pend.tool);
    if (!tool) return true;
    const args = prepararArgsTool({
      tool: tool.nome,
      args: { ...pend.args, ...(confirmacao.ajustes ?? {}) },
      oportunidadeId: conversa.oportunidadeId,
    });
    const erroArgs = (await validarArgs(tool, args)) ?? (await this.foraDeOrdem(conversa, tool, args));
    if (erroArgs) {
      await this.conversas.definirPendencia(conversa._id, null);
      await this.conversas.registrarConfirmacao(conversa._id, {
        callId: pend.callId,
        tool: pend.tool,
        decisao: 'confirmar',
        erro: erroArgs,
        concluidaEm: new Date(),
      });
      this.enviar(res, 'tool_resultado', {
        callId: pend.callId,
        tool: tool.nome,
        ok: false,
        resultado: null,
        erro: { mensagem: erroArgs, recuperavel: true },
      });
      await this.registrarResultado(conversa, {
        callId: pend.callId,
        tool: tool.nome,
        efeito: tool.efeito,
        args,
        ok: false,
        erro: erroArgs,
      });
      return true;
    }
    this.enviar(res, 'tool_call', {
      callId: pend.callId,
      tool: tool.nome,
      efeito: 'escrita',
      args,
      exigeConfirmacao: false,
    });
    const resultado = await this.executarTool(res, conversa, tool, pend.callId, args);
    const geracaoEmAndamento = tool.nome === 'gerar_curriculo'
      && resultado.ok
      && (await this.estaGerando(conversa, args));
    if (resultado.ok) {
      await this.conversas.definirPendencia(conversa._id, null);
      await this.conversas.registrarConfirmacao(conversa._id, { callId: pend.callId, tool: pend.tool, decisao: 'confirmar', resultado: resultado.valor, concluidaEm: new Date() });
      if (tool.nome === 'registrar_oportunidade' && resultado.valor && typeof resultado.valor === 'object' && 'id' in resultado.valor) {
        await this.aplicarResultadoTool(conversa, tool.nome, resultado.valor);
      }
    } else {
      await this.conversas.definirPendencia(conversa._id, { ...pend, executando: false });
    }
    if (geracaoEmAndamento) {
      this.finalizar(res, conversa._id, 'completo');
      return false;
    }
    return true;
  }

  private async laco(
    res: Response,
    conversa: ConversaCopilotoDoc,
    modo: 'assistido' | 'autopiloto',
  ): Promise<void> {
    for (let passo = 0; passo < MAX_PASSOS; passo++) {
      let turno: CopilotoTurno;
      let transmitido = false;
      try {
        turno = await this.ai.copilotoTurnStream(
          {
            modo,
            oportunidadeId: conversa.oportunidadeId,
            pipelineAts: await this.contextoPipeline(conversa),
            trocas: paraTrocas(conversa.mensagens, conversa.resumo?.ate ?? 0),
            resumo: conversa.resumo ?? null,
            tools: TOOLS_NATIVAS,
          },
          { operacao: `conversa:${conversa._id}`, usuarioId: conversa.usuarioId },
          (delta) => {
            transmitido = true;
            this.enviar(res, 'token', { delta });
          },
        );
      } catch (err) {
        if (err instanceof TurnoInterrompido && err.emitiu) {
          await this.registrarErro(conversa, 'ai-service', `resposta interrompida no meio: ${err.message}`);
          this.enviar(res, 'erro', {
            escopo: 'ai-service',
            mensagem: 'A resposta foi interrompida antes de terminar. Repita para continuar.',
            recuperavel: true,
          });
          this.finalizar(res, conversa._id, 'erro');
          return;
        }
        if (err instanceof CotaTokensEsgotada) {
          await this.registrarErro(conversa, 'cota', MENSAGEM_COTA_ESGOTADA);
          this.enviar(res, 'erro', {
            escopo: 'cota',
            mensagem: MENSAGEM_COTA_ESGOTADA,
            recuperavel: false,
            retryAfter: err.retryAfterSegundos,
          });
          this.finalizar(res, conversa._id, 'erro');
          return;
        }
        await this.registrarErro(conversa, 'ai-service', this.mensagemErro(err));
        this.enviar(res, 'erro', {
          escopo: 'ai-service',
          mensagem: this.mensagemErro(err),
          recuperavel: true,
        });
        this.finalizar(res, conversa._id, 'erro');
        return;
      }

      if (turno.resumo) {
        conversa.resumo = turno.resumo;
        await this.conversas.definirResumo(conversa._id, turno.resumo);
      }

      const blocos = turno.conteudo ?? [];
      const texto = blocos
        .flatMap((bloco) => (bloco.type === 'text' ? [bloco.text] : []))
        .join('\n\n')
        .trim();
      const chamadas = blocos.filter((bloco): bloco is ToolUse => bloco.type === 'tool_use');
      await this.registrar(conversa, { papel: 'assistant', conteudo: texto, blocos });
      if (!transmitido && texto) this.enviar(res, 'token', { delta: texto });

      if (chamadas.length === 0) {
        this.finalizar(res, conversa._id, 'completo');
        return;
      }

      const [chamada, ...excedentes] = chamadas;
      for (const extra of excedentes) {
        await this.registrarResultado(conversa, {
          callId: extra.id,
          tool: extra.name,
          efeito: TOOLS_POR_NOME.get(extra.name)?.efeito ?? 'leitura',
          args: extra.input ?? {},
          ok: false,
          erro: 'execute uma tool por vez',
        });
      }

      const callId = chamada.id;
      const tool = TOOLS_POR_NOME.get(chamada.name);
      if (!tool) {
        const erro = `tool desconhecida: ${chamada.name}`;
        this.enviar(res, 'tool_resultado', {
          callId,
          tool: chamada.name,
          ok: false,
          resultado: null,
          erro: { mensagem: erro, recuperavel: true },
        });
        await this.registrarResultado(conversa, {
          callId,
          tool: chamada.name,
          efeito: 'leitura',
          args: chamada.input ?? {},
          ok: false,
          erro,
        });
        continue;
      }

      const args = prepararArgsTool({
        tool: tool.nome,
        args: chamada.input ?? {},
        oportunidadeId: conversa.oportunidadeId,
      });
      const erroArgs = (await validarArgs(tool, args)) ?? (await this.foraDeOrdem(conversa, tool, args));
      if (erroArgs) {
        this.enviar(res, 'tool_resultado', {
          callId,
          tool: tool.nome,
          ok: false,
          resultado: null,
          erro: { mensagem: erroArgs, recuperavel: true },
        });
        await this.registrarResultado(conversa, {
          callId,
          tool: tool.nome,
          efeito: tool.efeito,
          args,
          ok: false,
          erro: erroArgs,
        });
        continue;
      }

      if (tool.nome === 'gerar_curriculo') {
        const pedida = await this.solicitarConfirmacaoGeracao(res, conversa, tool, callId, args);
        if (pedida) return;
        continue;
      }

      if (exigeConfirmacao(tool, modo)) {
        this.enviar(res, 'tool_call', {
          callId,
          tool: tool.nome,
          efeito: 'escrita',
          args,
          exigeConfirmacao: true,
        });
        this.enviar(res, 'confirmacao', {
          callId,
          tool: tool.nome,
          resumo: tool.resumo ? tool.resumo(args) : `Executar ${tool.nome}`,
          args,
        });
        await this.conversas.definirPendencia(conversa._id, {
          callId,
          tool: tool.nome,
          efeito: 'escrita',
          args,
          resumo: tool.resumo ? tool.resumo(args) : `Executar ${tool.nome}`,
        });
        this.finalizar(res, conversa._id, 'aguardando_confirmacao');
        return;
      }

      if (tool.efeito === 'entrega_externa') {
        this.enviar(res, 'tool_call', {
          callId,
          tool: tool.nome,
          efeito: 'leitura',
          args,
          exigeConfirmacao: false,
        });
        const entregue = await this.entregar(res, conversa, tool, callId, args);
        this.finalizar(
          res,
          conversa._id,
          entregue ? 'aguardando_acao_externa' : 'erro',
        );
        return;
      }

      this.enviar(res, 'tool_call', {
        callId,
        tool: tool.nome,
        efeito: tool.efeito,
        args,
        exigeConfirmacao: false,
      });
      const execucao = await this.executarTool(res, conversa, tool, callId, args);
      if (execucao.ok) {
        await this.aplicarResultadoTool(conversa, tool.nome, execucao.valor);
      }
    }

    await this.registrarErro(conversa, 'orquestracao', 'o turno excedeu o limite de passos e foi interrompido');
    this.enviar(res, 'erro', {
      escopo: 'orquestracao',
      mensagem: 'O turno foi interrompido antes de concluir. Repita para continuar.',
      recuperavel: true,
    });
    this.finalizar(res, conversa._id, 'erro');
  }

  private async contextoPipeline(
    conversa: ConversaCopilotoDoc,
  ): Promise<{ oportunidadeId: string; estado: string; descricao: string } | null> {
    if (!conversa.oportunidadeId) return null;
    try {
      const situacao = await this.pipelineAts.situacao(conversa.usuarioId, conversa.oportunidadeId);
      return { oportunidadeId: conversa.oportunidadeId, estado: situacao.estado, descricao: descreverParaAgente(situacao) };
    } catch {
      return null;
    }
  }

  private async foraDeOrdem(
    conversa: ConversaCopilotoDoc,
    tool: ToolDef,
    args: Record<string, unknown>,
  ): Promise<string | null> {
    const alvo = oportunidadeDosArgs(args);
    if (!alvo || !toolDependeDoPipeline(tool.nome, args)) return null;
    try {
      return await this.pipelineAts.ordem(conversa.usuarioId, alvo, tool.nome, args);
    } catch (err) {
      return this.mensagemErro(err);
    }
  }

  private async estaGerando(conversa: ConversaCopilotoDoc, args: Record<string, unknown>): Promise<boolean> {
    const alvo = oportunidadeDosArgs(args);
    if (!alvo) return false;
    const situacao = await this.pipelineAts.situacao(conversa.usuarioId, alvo);
    return situacao.estado === 'GERANDO';
  }

  private async recusarGeracao(conversa: ConversaCopilotoDoc, args: Record<string, unknown>): Promise<void> {
    const alvo = oportunidadeDosArgs(args) ?? conversa.oportunidadeId;
    if (!alvo) return;
    try {
      await this.pipelineAts.aplicar(conversa.usuarioId, alvo, { tipo: 'confirmacao_recusada' });
    } catch {
      return;
    }
  }

  private async solicitarConfirmacaoGeracao(
    res: Response,
    conversa: ConversaCopilotoDoc,
    tool: ToolDef,
    callId: string,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.pipelineAts.aplicar(conversa.usuarioId, String(args.oportunidadeId), { tipo: 'confirmacao_solicitada' });
    } catch (err) {
      const erro = this.mensagemErro(err);
      this.enviar(res, 'tool_resultado', { callId, tool: tool.nome, ok: false, resultado: null, erro: { mensagem: erro, recuperavel: true } });
      await this.registrarResultado(conversa, { callId, tool: tool.nome, efeito: tool.efeito, args, ok: false, erro });
      return false;
    }
    const resumo = 'Etapa 1 (Análise ATS) concluída. Podemos prosseguir para a Etapa 2 (Reescrita otimizada)?';
    this.enviar(res, 'tool_call', {
      callId,
      tool: tool.nome,
      efeito: 'escrita',
      args,
      exigeConfirmacao: true,
    });
    this.enviar(res, 'confirmacao', { callId, tool: tool.nome, resumo, args });
    await this.conversas.definirPendencia(conversa._id, {
      callId,
      tool: tool.nome,
      efeito: 'escrita',
      args,
      resumo,
    });
    this.finalizar(res, conversa._id, 'aguardando_confirmacao');
    return true;
  }

  private async executarTool(
    res: Response,
    conversa: ConversaCopilotoDoc,
    tool: ToolDef,
    callId: string,
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; valor?: unknown }> {
    try {
      const resultado =
        tool.nome === 'registrar_oportunidade' && conversa.oportunidadeId
          ? {
              ...((await this.executor.executar(
                conversa.usuarioId,
                TOOLS_POR_NOME.get('buscar_oportunidade')!,
                { oportunidadeId: conversa.oportunidadeId },
              )) as Record<string, unknown>),
              reaproveitada: true,
            }
          : await this.executor.executar(conversa.usuarioId, tool, args);
      this.enviar(res, 'tool_resultado', {
        callId,
        tool: tool.nome,
        ok: true,
        resultado,
        erro: null,
      });
      await this.registrarResultado(conversa, {
        callId,
        tool: tool.nome,
        efeito: tool.efeito,
        args,
        ok: true,
        resultado,
      });
      return { ok: true, valor: resultado };
    } catch (err) {
      const mensagem = this.mensagemErro(err);
      this.enviar(res, 'tool_resultado', {
        callId,
        tool: tool.nome,
        ok: false,
        resultado: null,
        erro: { mensagem, recuperavel: true },
      });
      await this.registrarResultado(conversa, {
        callId,
        tool: tool.nome,
        efeito: tool.efeito,
        args,
        ok: false,
        erro: mensagem,
      });
      return { ok: false };
    }
  }

  private async entregar(
    res: Response,
    conversa: ConversaCopilotoDoc,
    tool: ToolDef,
    callId: string,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const r = (await this.executor.executar(conversa.usuarioId, tool, args)) as {
        tipo: string;
        titulo: string;
        texto: string;
        destino?: string;
      };
      this.enviar(res, 'entrega_externa', {
        tipo: r.tipo,
        titulo: r.titulo,
        texto: r.texto,
        destino: r.destino ?? '',
      });
      const conteudo = `texto entregue ao candidato: ${r.titulo}`;
      await this.registrar(conversa, {
        papel: 'tool',
        tool: tool.nome,
        conteudo,
        blocos: [resultadoTool(callId, JSON.stringify({ entregue: true, titulo: r.titulo, texto: r.texto }))],
        dados: {
          callId,
          efeito: 'entrega_externa',
          ok: true,
          entrega: r,
        },
      });
      return true;
    } catch (err) {
      await this.registrarErro(conversa, 'ai-service', this.mensagemErro(err));
      this.enviar(res, 'erro', {
        escopo: 'ai-service',
        mensagem: this.mensagemErro(err),
        recuperavel: true,
      });
      return false;
    }
  }

  private enviar(res: Response, evento: string, data: unknown): void {
    res.write(`event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private finalizar(res: Response, conversaId: string, motivo: string): void {
    this.enviar(res, 'fim_turno', { motivo, conversaId });
    res.end();
  }

  private async registrar(
    conversa: ConversaCopilotoDoc,
    mensagem: MensagemCopiloto,
  ): Promise<void> {
    conversa.mensagens.push(mensagem);
    await this.conversas.anexar(conversa._id, mensagem);
  }

  private async registrarResultado(
    conversa: ConversaCopilotoDoc,
    registro: ResultadoRegistrado,
  ): Promise<void> {
    const conteudo = registro.ok
      ? this.resumirResultado(registro.resultado, registro.tool)
      : `falha: ${registro.erro}`;
    await this.registrar(conversa, {
      papel: 'tool',
      tool: registro.tool,
      conteudo,
      blocos: [resultadoTool(registro.callId, conteudo, !registro.ok)],
      dados: {
        callId: registro.callId,
        efeito: registro.efeito,
        args: registro.args,
        ok: registro.ok,
        ...(registro.ok
          ? { resultado: this.resultadoHistorico(registro.resultado, registro.tool) }
          : { erro: registro.erro }),
      },
    });
  }

  private async registrarErro(
    conversa: ConversaCopilotoDoc,
    escopo: string,
    mensagem: string,
  ): Promise<void> {
    await this.registrar(conversa, {
      papel: 'evento',
      conteudo: mensagem,
      dados: { evento: 'erro', escopo, erro: mensagem },
    });
  }

  private async aplicarResultadoTool(
    conversa: ConversaCopilotoDoc,
    tool: string,
    resultado: unknown,
  ): Promise<void> {
    if (
      tool !== 'registrar_oportunidade' ||
      !resultado ||
      typeof resultado !== 'object' ||
      !('id' in resultado)
    ) {
      return;
    }
    const oportunidadeId = String((resultado as { id: unknown }).id);
    conversa.oportunidadeId = oportunidadeId;
    await this.conversas.atualizarOportunidade(conversa._id, oportunidadeId);
  }

  private resumirResultado(resultado: unknown, tool: string): string {
    if (tool === 'buscar_curriculo' && resultado && typeof resultado === 'object') {
      const curriculo = resultado as Record<string, unknown>;
      return JSON.stringify({
        id: curriculo.id,
        vagaId: curriculo.vagaId,
        rotulo: curriculo.rotulo,
        score: curriculo.score,
        breakdown: curriculo.breakdown,
        analiseInicial: curriculo.analiseInicial,
        analiseFinal: curriculo.analiseFinal,
        degradacao: curriculo.degradacao,
        markdown: curriculo.markdown,
      });
    }
    const resultadoSeguro =
      tool === 'ler_perfil' && resultado && typeof resultado === 'object'
        ? semContato(resultado as Record<string, unknown>)
        : resultado;
    return JSON.stringify(resultadoSeguro ?? null);
  }

  private resultadoHistorico(resultado: unknown, tool: string): unknown {
    const resumo = this.resumirResultado(resultado, tool);
    try {
      return JSON.parse(resumo);
    } catch {
      return resultado;
    }
  }

  private mensagemErro(err: unknown): string {
    if (err instanceof HttpException) {
      const corpo = err.getResponse() as string | { message?: string | string[] };
      const mensagem = typeof corpo === 'string' ? corpo : corpo?.message;
      if (Array.isArray(mensagem)) return mensagem.join('; ');
      return mensagem ? String(mensagem) : err.message;
    }
    if (err instanceof AxiosError) {
      const data = err.response?.data as { message?: string; detail?: string } | undefined;
      if (data?.message) return String(data.message);
      if (data?.detail) return String(data.detail);
      if (err.code === 'ECONNREFUSED') return 'servico indisponivel';
      return err.message;
    }
    return err instanceof Error ? err.message : 'erro inesperado';
  }
}
