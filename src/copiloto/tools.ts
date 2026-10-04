import type { ToolNativa } from '../clients/ai.client';
import { ClasseDto, esquemaDoDto, OpcoesEsquema } from './esquema-dto';
import {
  AcaoAlvoDto,
  AtualizarCandidaturaToolDto,
  BancoVagaAlvoDto,
  CriarCandidaturaDto,
  CriarOportunidadeDto,
  CurriculoAlvoDto,
  DefinirProximoPassoDto,
  EditarCurriculoToolDto,
  EntradaAlvoDto,
  GeracaoAlvoDto,
  HojeQueryDto,
  LerTimelineDto,
  ListarCurriculosDto,
  ListarOportunidadesDto,
  MensagemRecrutadorDto,
  MoverEstagioDto,
  OportunidadeAlvoDto,
  RegistrarNotaDto,
  RespostasFormularioDto,
  SemArgumentosDto,
} from './tool-dtos';

export type EfeitoTool = 'leitura' | 'escrita' | 'entrega_externa';

export interface ToolDef {
  nome: string;
  efeito: EfeitoTool;
  descricao: string;
  dto: ClasseDto;
  esquema?: OpcoesEsquema;
  resumo?: (args: Args) => string;
}

type Args = Record<string, unknown>;

export const LIMITE_TOOLS_ESTRITAS = 20;
export const LIMITE_OPCIONAIS_ESTRITOS = 24;

const ID_OPORTUNIDADE = 'id da oportunidade; quando omitido, vale a oportunidade em foco';

const s = (v: unknown): string => (v == null ? '' : String(v));

export const TOOLS: ToolDef[] = [
  {
    nome: 'listar_oportunidades',
    efeito: 'leitura',
    descricao: 'Lista oportunidades do candidato, com filtros de visao e busca',
    dto: ListarOportunidadesDto,
    esquema: {
      descricoes: {
        visao: 'ativas (padrao), encerradas ou entrada (vagas ainda nao ativadas)',
        busca: 'texto livre sobre titulo e empresa',
      },
    },
  },
  {
    nome: 'buscar_oportunidade',
    efeito: 'leitura',
    descricao: 'Detalha uma oportunidade',
    dto: OportunidadeAlvoDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE } },
  },
  {
    nome: 'abrir_workspace',
    efeito: 'leitura',
    descricao: 'Abre o workspace com candidatura, curriculos e acoes da oportunidade',
    dto: OportunidadeAlvoDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE } },
  },
  {
    nome: 'ler_timeline',
    efeito: 'leitura',
    descricao: 'Le o historico da oportunidade, do mais recente para o mais antigo',
    dto: LerTimelineDto,
    esquema: {
      descricoes: {
        oportunidadeId: ID_OPORTUNIDADE,
        cursor: 'data ISO; traz eventos anteriores a ela',
        limite: 'quantidade de eventos, de 1 a 100',
      },
    },
  },
  {
    nome: 'listar_acoes',
    efeito: 'leitura',
    descricao: 'Lista as acoes de agenda da oportunidade',
    dto: OportunidadeAlvoDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE } },
  },
  {
    nome: 'ler_perfil',
    efeito: 'leitura',
    descricao: 'Le o perfil-mestre do candidato, sem dados de contato',
    dto: SemArgumentosDto,
  },
  {
    nome: 'listar_curriculos',
    efeito: 'leitura',
    descricao: 'Lista curriculos gerados',
    dto: ListarCurriculosDto,
    esquema: {
      descricoes: {
        vagaId: 'id da oportunidade',
        scoreMinimo: 'score ATS minimo, de 0 a 100',
        vinculado: 'true para curriculos ja usados em candidatura, false para os demais',
      },
    },
  },
  {
    nome: 'buscar_curriculo',
    efeito: 'leitura',
    descricao: 'Le um curriculo concluido com o score e o breakdown ATS deterministico',
    dto: CurriculoAlvoDto,
  },
  {
    nome: 'status_geracao',
    efeito: 'leitura',
    descricao: 'Consulta uma geracao de curriculo pelo id devolvido ao inicia-la',
    dto: GeracaoAlvoDto,
    esquema: { descricoes: { jobId: 'id devolvido por gerar_curriculo' } },
  },
  {
    nome: 'listar_banco_vagas',
    efeito: 'leitura',
    descricao: 'Lista o banco de vagas importadas',
    dto: SemArgumentosDto,
  },
  {
    nome: 'ler_agenda',
    efeito: 'leitura',
    descricao: 'Le a agenda de proximos passos do candidato',
    dto: HojeQueryDto,
    esquema: {
      descricoes: {
        de: 'data ISO inicial',
        ate: 'data ISO final',
        periodo: 'janela em dias a partir de hoje',
      },
    },
  },

  {
    nome: 'registrar_oportunidade',
    efeito: 'escrita',
    descricao: 'Registra uma oportunidade a partir da descricao de uma vaga',
    dto: CriarOportunidadeDto,
    esquema: { descricoes: { fonte: 'url ou origem da vaga' } },
    resumo: (a) => `Registrar a oportunidade ${s(a.titulo)} na ${s(a.empresa)}`,
  },
  {
    nome: 'ativar_entrada',
    efeito: 'escrita',
    descricao: 'Ativa uma entrada da visao de entrada como oportunidade',
    dto: EntradaAlvoDto,
    resumo: () => 'Ativar a entrada como oportunidade',
  },
  {
    nome: 'ativar_banco_vaga',
    efeito: 'escrita',
    descricao: 'Ativa uma vaga do banco de vagas como oportunidade',
    dto: BancoVagaAlvoDto,
    resumo: () => 'Ativar a vaga do banco como oportunidade',
  },
  {
    nome: 'analisar_ats',
    efeito: 'leitura',
    descricao:
      'Analise ATS do perfil-mestre contra a vaga: score, keywords encontradas e ausentes, pontos eliminatorios e veredicto',
    dto: OportunidadeAlvoDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE } },
  },
  {
    nome: 'gerar_curriculo',
    efeito: 'escrita',
    descricao:
      'Pede ao candidato a confirmacao da reescrita otimizada do curriculo para a vaga; confirmada, a geracao roda em segundo plano e a conclusao chega na conversa',
    dto: OportunidadeAlvoDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE } },
    resumo: () => 'Gerar o curriculo tailored para a oportunidade',
  },
  {
    nome: 'editar_curriculo',
    efeito: 'escrita',
    descricao: 'Substitui o markdown de um curriculo e recomputa o score',
    dto: EditarCurriculoToolDto,
    esquema: { descricoes: { markdown: 'curriculo completo em markdown', rotulo: 'nome curto da versao' } },
    resumo: () => 'Editar o curriculo e recomputar o score',
  },
  {
    nome: 'definir_proximo_passo',
    efeito: 'escrita',
    descricao:
      'Cria uma acao na agenda da oportunidade. Nao serve para acompanhar geracao de curriculo (use status_geracao) nem para redigir mensagem ao recrutador (use redigir_mensagem_recrutador)',
    dto: DefinirProximoPassoDto,
    esquema: {
      omitir: ['candidaturaId'],
      descricoes: {
        oportunidadeId: ID_OPORTUNIDADE,
        titulo: 'o que o candidato vai fazer',
        tipo: 'categoria da acao',
        venceEm: 'prazo em data ISO',
        lembrarEm: 'lembrete em data ISO',
        principal: 'marca como o proximo passo principal da oportunidade',
      },
    },
    resumo: (a) => `Definir o proximo passo: ${s(a.titulo)}`,
  },
  {
    nome: 'concluir_passo',
    efeito: 'escrita',
    descricao: 'Conclui uma acao de agenda',
    dto: AcaoAlvoDto,
    resumo: () => 'Concluir o passo',
  },
  {
    nome: 'mover_estagio',
    efeito: 'escrita',
    descricao: 'Move a oportunidade para outro estagio do pipeline',
    dto: MoverEstagioDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE, motivo: 'motivo da mudanca, quando houver' } },
    resumo: (a) => `Mover a oportunidade para ${s(a.destino)}`,
  },
  {
    nome: 'registrar_candidatura',
    efeito: 'escrita',
    descricao: 'Registra a candidatura depois que o candidato se inscreveu',
    dto: CriarCandidaturaDto,
    esquema: { descricoes: { vagaId: 'id da oportunidade', curriculoId: 'curriculo usado na inscricao' } },
    resumo: () => 'Registrar a candidatura',
  },
  {
    nome: 'atualizar_candidatura',
    efeito: 'escrita',
    descricao: 'Atualiza status, notas ou curriculo de uma candidatura',
    dto: AtualizarCandidaturaToolDto,
    resumo: () => 'Atualizar a candidatura',
  },
  {
    nome: 'registrar_nota',
    efeito: 'escrita',
    descricao: 'Registra uma nota no historico da oportunidade',
    dto: RegistrarNotaDto,
    esquema: { descricoes: { oportunidadeId: ID_OPORTUNIDADE, descricao: 'texto da nota' } },
    resumo: () => 'Registrar a nota no historico',
  },

  {
    nome: 'redigir_mensagem_recrutador',
    efeito: 'entrega_externa',
    descricao: 'Redige a mensagem ao recrutador e entrega o texto para o candidato revisar e enviar',
    dto: MensagemRecrutadorDto,
    esquema: { descricoes: { oportunidadeId: 'id da oportunidade', contexto: 'contexto dado pelo candidato' } },
  },
  {
    nome: 'redigir_respostas_formulario',
    efeito: 'entrega_externa',
    descricao: 'Redige respostas para campos de formulario de candidatura e entrega o texto para o candidato usar',
    dto: RespostasFormularioDto,
    esquema: { descricoes: { oportunidadeId: 'id da oportunidade', campos: 'perguntas do formulario' } },
  },
];

export const TOOLS_POR_NOME = new Map(TOOLS.map((t) => [t.nome, t]));

const PRIORIDADE_ESTRITA: Record<EfeitoTool, number> = { escrita: 0, entrega_externa: 1, leitura: 2 };

export function montarToolsNativas(tools: ToolDef[]): ToolNativa[] {
  const esquemas = tools.map((tool) => esquemaDoDto(tool.dto, tool.esquema));
  const ordem = tools
    .map((tool, indice) => ({ tool, indice, opcionais: esquemas[indice].opcionais }))
    .sort(
      (a, b) =>
        PRIORIDADE_ESTRITA[a.tool.efeito] - PRIORIDADE_ESTRITA[b.tool.efeito] ||
        a.opcionais - b.opcionais ||
        a.indice - b.indice,
    );
  const estritas = new Set<number>();
  let opcionais = 0;
  for (const item of ordem) {
    if (estritas.size >= LIMITE_TOOLS_ESTRITAS) break;
    if (Object.keys(esquemas[item.indice].schema.properties as object).length === 0) continue;
    if (opcionais + item.opcionais > LIMITE_OPCIONAIS_ESTRITOS) continue;
    estritas.add(item.indice);
    opcionais += item.opcionais;
  }
  return tools.map((tool, indice) => ({
    name: tool.nome,
    description: tool.descricao,
    input_schema: esquemas[indice].schema,
    ...(estritas.has(indice) ? { strict: true } : {}),
  }));
}

export const TOOLS_NATIVAS: ToolNativa[] = montarToolsNativas(TOOLS);
