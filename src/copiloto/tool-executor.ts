import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { AcoesService } from '../acoes/acoes.service';
import { BancoVagasService } from '../banco-vagas/banco-vagas.service';
import { CandidaturasService } from '../candidaturas/candidaturas.service';
import { CotaTokensService } from '../cota/cota-tokens.service';
import { CurriculosService } from '../curriculos/curriculos.service';
import { HojeService } from '../hoje/hoje.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PerfilService } from '../perfil/perfil.service';
import { CapacidadesService } from './capacidades.service';
import type { ToolDef } from './tools';

type Args = Record<string, any>;
type Execucao = (usuarioId: string, args: Args) => Promise<unknown>;

export const TOOLS_COM_COTA = new Set([
  'registrar_oportunidade',
  'gerar_curriculo',
  'redigir_mensagem_recrutador',
  'redigir_respostas_formulario',
]);

export class ArgumentosInvalidos extends Error {}

function ultimoNumero(texto: string): string {
  return texto.match(/\d+/g)?.at(-1) ?? '';
}

function valoresAceitos(texto: string): string {
  const inicio = texto.indexOf(':');
  return inicio >= 0 ? texto.slice(inicio + 1).trim() : '';
}

const TRADUCOES: Record<string, (texto: string) => string> = {
  whitelistValidation: () => 'campo que esta ação não aceita',
  isString: () => 'deve ser texto',
  isInt: () => 'deve ser um número inteiro',
  isNumber: () => 'deve ser um número',
  isBoolean: () => 'deve ser verdadeiro ou falso',
  isDateString: () => 'deve ser uma data no formato ISO 8601',
  isIso8601: () => 'deve ser uma data no formato ISO 8601',
  isArray: () => 'deve ser uma lista',
  isNotEmpty: () => 'não pode ficar vazio',
  isEnum: (texto) => `deve ser um destes valores: ${valoresAceitos(texto)}`,
  isIn: (texto) => `deve ser um destes valores: ${valoresAceitos(texto)}`,
  maxLength: (texto) => `deve ter no máximo ${ultimoNumero(texto)} caracteres`,
  minLength: (texto) => `deve ter no mínimo ${ultimoNumero(texto)} caracteres`,
  max: (texto) => `não pode ser maior que ${ultimoNumero(texto)}`,
  min: (texto) => `não pode ser menor que ${ultimoNumero(texto)}`,
  arrayMaxSize: (texto) => `deve ter no máximo ${ultimoNumero(texto)} itens`,
  arrayMinSize: (texto) => `deve ter pelo menos ${ultimoNumero(texto)} itens`,
  nestedValidation: () => 'deve ser um objeto ou uma lista de objetos',
};

export function traduzirRestricao(restricao: string, texto: string): string {
  const traducao = TRADUCOES[restricao];
  return traducao ? traducao(texto) : texto;
}

function mensagens(erros: ValidationError[], prefixo = ''): string[] {
  return erros.flatMap((erro) => {
    const caminho = `${prefixo}${erro.property}`;
    const proprias = Object.entries(erro.constraints ?? {}).map(
      ([restricao, texto]) => `${caminho}: ${traduzirRestricao(restricao, texto)}`,
    );
    return [...proprias, ...mensagens(erro.children ?? [], `${caminho}.`)];
  });
}

export async function validarArgs(tool: ToolDef, args: Args): Promise<string | null> {
  const instancia = plainToInstance(tool.dto, args ?? {});
  const erros = await validate(instancia, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
  });
  if (erros.length === 0) return null;
  return `argumentos inválidos para ${tool.nome}: ${mensagens(erros).join('; ')}`;
}

function semPaginacao(data: unknown): unknown {
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

@Injectable()
export class ToolExecutor {
  private readonly execucoes: Record<string, Execucao>;

  constructor(
    private readonly oportunidades: OportunidadesService,
    private readonly acoes: AcoesService,
    private readonly curriculos: CurriculosService,
    private readonly perfil: PerfilService,
    private readonly bancoVagas: BancoVagasService,
    private readonly hoje: HojeService,
    private readonly candidaturas: CandidaturasService,
    private readonly capacidades: CapacidadesService,
    private readonly cota: CotaTokensService,
  ) {
    this.execucoes = {
      listar_oportunidades: async (u, a) =>
        semPaginacao(
          await this.oportunidades.listar(u, {
            visao: a.visao,
            busca: a.busca,
            categoria: a.categoria,
            nivel: a.nivel,
            prioridade: a.prioridade,
            ordenarPor: a.ordenarPor,
          }),
        ),
      buscar_oportunidade: (u, a) => this.oportunidades.buscar(u, a.oportunidadeId),
      abrir_workspace: (u, a) => this.oportunidades.workspace(u, a.oportunidadeId),
      ler_timeline: (u, a) => this.oportunidades.timeline(u, a.oportunidadeId, a.cursor, a.limite ?? 30),
      listar_acoes: (u, a) => this.acoes.listar(u, a.oportunidadeId),
      ler_perfil: (u) => this.perfil.buscar(u),
      listar_curriculos: async (u, a) =>
        semPaginacao(
          await this.curriculos.listar(u, {
            vagaId: a.vagaId,
            scoreMinimo: a.scoreMinimo,
            vinculado: a.vinculado,
          }),
        ),
      buscar_curriculo: (u, a) => this.curriculos.buscar(u, a.curriculoId),
      status_geracao: (u, a) => this.curriculos.statusGeracao(u, a.jobId),
      listar_banco_vagas: (u) => this.bancoVagas.listar(u),
      ler_agenda: async (u, a) => {
        await this.hoje.garantirPreferencia(u);
        return this.hoje.agenda(u, a.de, a.ate, a.periodo);
      },
      registrar_oportunidade: (u, a) =>
        this.oportunidades.criar(u, {
          titulo: a.titulo,
          empresa: a.empresa,
          descricao: a.descricao,
          fonte: a.fonte,
        }),
      ativar_entrada: (u, a) => this.oportunidades.ativarEntrada(u, a.entradaId),
      ativar_banco_vaga: (u, a) => this.bancoVagas.ativar(u, a.bancoVagaId),
      analisar_ats: (u, a) => this.curriculos.analisarAts(u, a.oportunidadeId),
      gerar_curriculo: (u, a) => this.curriculos.gerar(u, a.oportunidadeId, 'confirmacao'),
      editar_curriculo: (u, a) =>
        this.curriculos.editar(u, a.curriculoId, { markdown: a.markdown, rotulo: a.rotulo }),
      definir_proximo_passo: (u, a) =>
        this.acoes.criar(u, a.oportunidadeId, {
          titulo: a.titulo,
          tipo: a.tipo,
          venceEm: a.venceEm,
          lembrarEm: a.lembrarEm,
          principal: a.principal,
        }),
      concluir_passo: (u, a) => this.acoes.concluir(u, a.acaoId),
      mover_estagio: (u, a) => this.oportunidades.transicionar(u, a.oportunidadeId, a.destino, a.motivo),
      registrar_candidatura: (u, a) =>
        this.candidaturas.criar(u, { vagaId: a.vagaId, curriculoId: a.curriculoId }),
      atualizar_candidatura: (u, a) =>
        this.candidaturas.atualizar(u, a.candidaturaId, {
          status: a.status,
          notas: a.notas,
          curriculoId: a.curriculoId,
        }),
      registrar_nota: (u, a) => this.oportunidades.registrarNota(u, a.oportunidadeId, a.descricao),
      redigir_mensagem_recrutador: (u, a) =>
        this.capacidades.mensagemRecrutador(u, a.oportunidadeId, a.contexto),
      redigir_respostas_formulario: (u, a) =>
        this.capacidades.respostasFormulario(u, a.oportunidadeId, a.campos),
    };
  }

  async executar(usuarioId: string, tool: ToolDef, args: Args): Promise<unknown> {
    const erro = await validarArgs(tool, args);
    if (erro) throw new ArgumentosInvalidos(erro);
    const execucao = this.execucoes[tool.nome];
    if (!execucao) throw new ArgumentosInvalidos(`tool sem execucao: ${tool.nome}`);
    if (TOOLS_COM_COTA.has(tool.nome)) await this.cota.verificar(usuarioId);
    return execucao(usuarioId, args);
  }
}
