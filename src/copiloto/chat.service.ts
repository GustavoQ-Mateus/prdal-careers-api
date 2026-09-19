import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { AuthUser } from '../auth/current-user.decorator';
import { CopilotoTurno } from '../clients/ai.client';
import { AiClient } from '../clients/ai.client';
import { ConversaCopilotoDoc, MensagemCopiloto } from '../mongo/mongo.service';
import { ConversasService } from './conversas.service';
import { ChatDto } from './copiloto.dto';
import { prepararArgsTool } from './tool-args';
import { CATALOGO_TOOLS, ToolDef, TOOLS_POR_NOME } from './tools';

const MAX_PASSOS = 8;
const LIMITE_HISTORICO = 2000;
@Injectable()
export class ChatService {
  private readonly selfUrl =
    process.env.API_SELF_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;

  constructor(
    private readonly conversas: ConversasService,
    private readonly ai: AiClient,
    private readonly http: HttpService,
  ) {}

  async chat(
    res: Response,
    user: AuthUser,
    authHeader: string,
    dto: ChatDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const modo = dto.modo ?? 'autopiloto';
    const conversa = await this.conversas.abrir(
      user.userId,
      dto.conversaId,
      modo,
      dto.oportunidadeId ?? null,
    );

    try {
      if (dto.confirmacao) {
        const seguir = await this.resolverConfirmacao(
          res,
          conversa,
          authHeader,
          dto,
        );
        if (!seguir) return;
      } else if (dto.mensagem) {
        if (conversa.pendencia) {
          await this.conversas.definirPendencia(conversa._id, null);
          conversa.pendencia = null;
        }
        await this.registrar(conversa, { papel: 'user', conteudo: dto.mensagem });
      }

      await this.laco(res, conversa, authHeader, modo);
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
    authHeader: string,
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
      await this.conversas.registrarConfirmacao(conversa._id, { callId: pend.callId, tool: pend.tool, decisao: 'recusar', concluidaEm: new Date() });
      await this.registrar(conversa, {
        papel: 'tool',
        tool: pend.tool,
        conteudo: 'o candidato recusou esta escrita; nao repita',
      });
      return true;
    }

    const tool = TOOLS_POR_NOME.get(pend.tool);
    if (!tool) return true;
    const preparados = prepararArgsTool({
      tool: tool.nome,
      args: { ...pend.args, ...(confirmacao.ajustes ?? {}) },
      oportunidadeId: conversa.oportunidadeId,
      mensagens: conversa.mensagens,
    });
    const args = preparados.args;
    if (preparados.erro) {
      await this.conversas.definirPendencia(conversa._id, null);
      await this.conversas.registrarConfirmacao(conversa._id, {
        callId: pend.callId,
        tool: pend.tool,
        decisao: 'confirmar',
        erro: preparados.erro,
        concluidaEm: new Date(),
      });
      this.enviar(res, 'tool_resultado', {
        callId: pend.callId,
        tool: tool.nome,
        ok: false,
        resultado: null,
        erro: { mensagem: preparados.erro, recuperavel: true },
      });
      await this.registrar(conversa, {
        papel: 'tool',
        tool: tool.nome,
        conteudo: `falha: ${preparados.erro}`,
        dados: {
          callId: pend.callId,
          efeito: tool.efeito,
          args,
          ok: false,
          erro: preparados.erro,
        },
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
    const resultado = await this.executarTool(res, conversa, authHeader, tool, pend.callId, args);
    const geracaoEmAndamento = tool.nome === 'gerar_curriculo'
      && resultado.ok
      && this.geracaoEmAndamento(resultado.valor);
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
    authHeader: string,
    modo: 'assistido' | 'autopiloto',
  ): Promise<void> {
    for (let passo = 0; passo < MAX_PASSOS; passo++) {
      let turno: CopilotoTurno;
      try {
        turno = await this.ai.copilotoTurn({
          modo,
          oportunidadeId: conversa.oportunidadeId,
          mensagens: conversa.mensagens,
          tools: CATALOGO_TOOLS,
        });
      } catch (err) {
        await this.registrarErro(conversa, 'ai-service', this.mensagemErro(err));
        this.enviar(res, 'erro', {
          escopo: 'ai-service',
          mensagem: this.mensagemErro(err),
          recuperavel: true,
        });
        this.finalizar(res, conversa._id, 'erro');
        return;
      }

      if (turno.tipo === 'texto' || !turno.tool) {
        const texto = turno.texto ?? '';
        this.streamTokens(res, texto);
        await this.registrar(conversa, { papel: 'assistant', conteudo: texto });
        this.finalizar(res, conversa._id, 'completo');
        return;
      }

      const tool = TOOLS_POR_NOME.get(turno.tool);
      if (!tool) {
        await this.registrarErro(conversa, 'tool', `tool desconhecida: ${turno.tool}`);
        this.enviar(res, 'erro', {
          escopo: 'tool',
          mensagem: `tool desconhecida: ${turno.tool}`,
          recuperavel: true,
        });
        this.finalizar(res, conversa._id, 'erro');
        return;
      }

      const preparados = prepararArgsTool({
        tool: tool.nome,
        args: turno.args ?? {},
        oportunidadeId: conversa.oportunidadeId,
        mensagens: conversa.mensagens,
      });
      const args = preparados.args;
      const callId = randomUUID();
      if (preparados.erro) {
        this.enviar(res, 'tool_resultado', {
          callId,
          tool: tool.nome,
          ok: false,
          resultado: null,
          erro: { mensagem: preparados.erro, recuperavel: true },
        });
        await this.registrar(conversa, {
          papel: 'tool',
          tool: tool.nome,
          conteudo: `falha: ${preparados.erro}`,
          dados: {
            callId,
            efeito: tool.efeito,
            args,
            ok: false,
            erro: preparados.erro,
          },
        });
        continue;
      }

      if (tool.efeito === 'escrita' && modo === 'assistido') {
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
        const entregue = await this.entregar(
          res,
          conversa,
          authHeader,
          tool,
          args,
        );
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
      const execucao = await this.executarTool(res, conversa, authHeader, tool, callId, args);
      if (execucao.ok) {
        await this.aplicarResultadoTool(conversa, tool.nome, execucao.valor);
      }
      if (tool.nome === 'gerar_curriculo' && execucao.ok && this.geracaoEmAndamento(execucao.valor)) {
        this.finalizar(res, conversa._id, 'completo');
        return;
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

  private geracaoEmAndamento(inicio: unknown): boolean {
    if (!inicio || typeof inicio !== 'object') return false;
    const geracao = inicio as Record<string, unknown>;
    return typeof geracao.jobId === 'string'
      && !['CONCLUIDA', 'ERRO'].includes(String(geracao.status ?? 'GERANDO'));
  }

  private async executarTool(
    res: Response,
    conversa: ConversaCopilotoDoc,
    authHeader: string,
    tool: ToolDef,
    callId: string,
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; valor?: unknown }> {
    try {
      const resultado =
        tool.nome === 'registrar_oportunidade' && conversa.oportunidadeId
          ? {
              ...((await this.requisitar(
                TOOLS_POR_NOME.get('buscar_oportunidade')!,
                { oportunidadeId: conversa.oportunidadeId },
                authHeader,
              )) as Record<string, unknown>),
              reaproveitada: true,
            }
          : await this.requisitar(tool, args, authHeader);
      this.enviar(res, 'tool_resultado', {
        callId,
        tool: tool.nome,
        ok: true,
        resultado,
        erro: null,
      });
      await this.registrar(conversa, {
        papel: 'tool',
        tool: tool.nome,
        conteudo: this.resumirResultado(resultado, tool.nome),
        dados: {
          callId,
          efeito: tool.efeito,
          args,
          ok: true,
          resultado: this.resultadoHistorico(resultado, tool.nome),
        },
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
      await this.registrar(conversa, {
        papel: 'tool',
        tool: tool.nome,
        conteudo: `falha: ${mensagem}`,
        dados: {
          callId,
          efeito: tool.efeito,
          args,
          ok: false,
          erro: mensagem,
        },
      });
      return { ok: false };
    }
  }

  private async entregar(
    res: Response,
    conversa: ConversaCopilotoDoc,
    authHeader: string,
    tool: ToolDef,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const r = (await this.requisitar(tool, args, authHeader)) as {
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
      await this.registrar(conversa, {
        papel: 'tool',
        tool: tool.nome,
        conteudo: `texto entregue ao candidato: ${r.titulo}`,
        dados: {
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

  private async requisitar(
    tool: ToolDef,
    args: Record<string, unknown>,
    authHeader: string,
  ): Promise<unknown> {
    const req = tool.requisicao(args);
    const { data } = await firstValueFrom(
      this.http.request({
        method: req.metodo,
        url: `${this.selfUrl}${req.caminho}`,
        params: req.query,
        data: req.corpo,
        headers: { Authorization: authHeader },
        timeout: 120000,
      }),
    );
    return this.desembrulhar(data);
  }

  private desembrulhar(data: unknown): unknown {
    if (
      data !== null &&
      typeof data === 'object' &&
      Array.isArray((data as { itens?: unknown }).itens) &&
      typeof (data as { total?: unknown }).total === 'number'
    ) {
      return (data as { itens: unknown }).itens;
    }
    return data;
  }

  private streamTokens(res: Response, texto: string): void {
    if (!texto) return;
    for (const parte of texto.match(/\S+\s*/g) ?? [texto]) {
      this.enviar(res, 'token', { delta: parte });
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
      const markdown = String(curriculo.markdown ?? '');
      return JSON.stringify({
        id: curriculo.id,
        vagaId: curriculo.vagaId,
        rotulo: curriculo.rotulo,
        score: curriculo.score,
        breakdown: curriculo.breakdown,
        analiseInicial: curriculo.analiseInicial,
        analiseFinal: curriculo.analiseFinal,
        degradacao: curriculo.degradacao,
        markdown:
          markdown.length > LIMITE_HISTORICO
            ? `${markdown.slice(0, LIMITE_HISTORICO)}...`
            : markdown,
      });
    }
    const texto = JSON.stringify(resultado ?? null);
    return texto.length > LIMITE_HISTORICO
      ? `${texto.slice(0, LIMITE_HISTORICO)}...`
      : texto;
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
