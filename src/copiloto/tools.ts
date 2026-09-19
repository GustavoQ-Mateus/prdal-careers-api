import { TIPOS_ACAO_OPORTUNIDADE } from './tool-args';

export type EfeitoTool = 'leitura' | 'escrita' | 'entrega_externa';

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH';

export interface RequisicaoTool {
  metodo: Metodo;
  caminho: string;
  corpo?: Record<string, unknown>;
  query?: Record<string, string>;
}

export interface ToolDef {
  nome: string;
  efeito: EfeitoTool;
  descricao: string;
  parametros: Record<string, string>;
  resumo?: (args: Args) => string;
  requisicao: (args: Args) => RequisicaoTool;
}

type Args = Record<string, unknown>;

const s = (v: unknown): string => (v == null ? '' : String(v));

const query = (args: Args, chaves: string[]): Record<string, string> => {
  const q: Record<string, string> = {};
  for (const chave of chaves) {
    if (args[chave] != null && args[chave] !== '') q[chave] = s(args[chave]);
  }
  return q;
};

const corpo = (args: Args, chaves: string[]): Record<string, unknown> => {
  const c: Record<string, unknown> = {};
  for (const chave of chaves) {
    if (args[chave] !== undefined) c[chave] = args[chave];
  }
  return c;
};

export const TOOLS: ToolDef[] = [
  {
    nome: 'listar_oportunidades',
    efeito: 'leitura',
    descricao: 'Lista oportunidades do candidato, com filtros de visao e busca',
    parametros: {
      visao: 'ativas | encerradas | entrada',
      busca: 'texto',
      categoria: 'texto',
      nivel: 'texto',
      prioridade: 'BAIXA | MEDIA | ALTA',
      ordenarPor: 'prioridade | score | keywords | etapa | prazo',
    },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: '/oportunidades',
      query: query(a, [
        'visao',
        'busca',
        'categoria',
        'nivel',
        'prioridade',
        'ordenarPor',
      ]),
    }),
  },
  {
    nome: 'buscar_oportunidade',
    efeito: 'leitura',
    descricao: 'Detalha uma oportunidade',
    parametros: { oportunidadeId: 'id da oportunidade' },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: `/oportunidades/${s(a.oportunidadeId)}`,
    }),
  },
  {
    nome: 'abrir_workspace',
    efeito: 'leitura',
    descricao: 'Abre o workspace com candidatura, curriculos e acoes da oportunidade',
    parametros: { oportunidadeId: 'id da oportunidade' },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/workspace`,
    }),
  },
  {
    nome: 'ler_timeline',
    efeito: 'leitura',
    descricao: 'Le o historico da oportunidade',
    parametros: {
      oportunidadeId: 'id da oportunidade',
      cursor: 'data ISO do cursor',
      limite: 'quantidade',
    },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/timeline`,
      query: query(a, ['cursor', 'limite']),
    }),
  },
  {
    nome: 'listar_acoes',
    efeito: 'leitura',
    descricao: 'Lista as acoes da oportunidade',
    parametros: { oportunidadeId: 'id da oportunidade' },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/acoes`,
    }),
  },
  {
    nome: 'ler_perfil',
    efeito: 'leitura',
    descricao: 'Le o perfil-mestre do candidato',
    parametros: {},
    requisicao: () => ({ metodo: 'GET', caminho: '/perfil-mestre' }),
  },
  {
    nome: 'listar_curriculos',
    efeito: 'leitura',
    descricao: 'Lista curriculos gerados',
    parametros: {
      vagaId: 'id da vaga',
      scoreMinimo: 'inteiro',
      vinculado: 'sim | nao',
    },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: '/curriculos',
      query: query(a, ['vagaId', 'scoreMinimo', 'vinculado']),
    }),
  },
  {
    nome: 'buscar_curriculo',
    efeito: 'leitura',
    descricao:
      'Etapa 3 obrigatoria: le o curriculo concluido e seu score/breakdown ATS deterministico antes de qualquer acao externa',
    parametros: { curriculoId: 'id do curriculo' },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: `/curriculos/${s(a.curriculoId)}`,
    }),
  },
  {
    nome: 'status_geracao',
    efeito: 'leitura',
    descricao:
      'Consulta exclusivamente uma geracao em andamento; quando status for CONCLUIDA, chame buscar_curriculo com o curriculoId retornado',
    parametros: { jobId: 'id da geracao' },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: `/geracoes-curriculo/${s(a.jobId)}`,
    }),
  },
  {
    nome: 'listar_banco_vagas',
    efeito: 'leitura',
    descricao: 'Lista o banco de vagas importadas',
    parametros: {},
    requisicao: () => ({ metodo: 'GET', caminho: '/banco-vagas' }),
  },
  {
    nome: 'ler_agenda',
    efeito: 'leitura',
    descricao: 'Le a agenda de proximos passos',
    parametros: { de: 'data ISO', ate: 'data ISO' },
    requisicao: (a) => ({
      metodo: 'GET',
      caminho: '/hoje',
      query: query(a, ['de', 'ate']),
    }),
  },

  {
    nome: 'registrar_oportunidade',
    efeito: 'escrita',
    descricao: 'Registra uma oportunidade a partir de uma descricao de vaga',
    parametros: {
      titulo: 'texto',
      empresa: 'texto',
      descricao: 'texto',
      fonte: 'texto opcional',
    },
    resumo: (a) =>
      `Registrar a oportunidade ${s(a.titulo)} na ${s(a.empresa)}`,
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: '/oportunidades',
      corpo: corpo(a, ['titulo', 'empresa', 'descricao', 'fonte']),
    }),
  },
  {
    nome: 'ativar_entrada',
    efeito: 'escrita',
    descricao: 'Ativa uma entrada da visao de entrada como oportunidade',
    parametros: { entradaId: 'id da entrada' },
    resumo: () => 'Ativar a entrada como oportunidade',
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/oportunidades/entradas/${s(a.entradaId)}/ativar`,
    }),
  },
  {
    nome: 'ativar_banco_vaga',
    efeito: 'escrita',
    descricao: 'Ativa uma vaga do banco de vagas como oportunidade',
    parametros: { bancoVagaId: 'id no banco de vagas' },
    resumo: () => 'Ativar a vaga do banco como oportunidade',
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/banco-vagas/${s(a.bancoVagaId)}/ativar`,
    }),
  },
  {
    nome: 'analisar_ats',
    efeito: 'leitura',
    descricao:
      'Etapa 1 do pipeline ATS: analisa o perfil-mestre contra a vaga e devolve score, keywords encontradas, ausentes, pontos eliminatorios e veredicto antes da geracao',
    parametros: { oportunidadeId: 'id da oportunidade' },
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/analisar-ats`,
    }),
  },
  {
    nome: 'gerar_curriculo',
    efeito: 'escrita',
    descricao:
      'Etapa 2 do pipeline ATS: inicia a reescrita otimizada depois da confirmacao explicita do candidato; depois acompanhe somente com status_geracao',
    parametros: { oportunidadeId: 'id da oportunidade' },
    resumo: () => 'Gerar o curriculo tailored para a oportunidade',
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/gerar-cv`,
    }),
  },
  {
    nome: 'editar_curriculo',
    efeito: 'escrita',
    descricao: 'Edita o markdown de um curriculo e recomputa o score',
    parametros: {
      curriculoId: 'id do curriculo',
      markdown: 'novo markdown',
      rotulo: 'rotulo opcional',
    },
    resumo: () => 'Editar o curriculo e recomputar o score',
    requisicao: (a) => ({
      metodo: 'PUT',
      caminho: `/curriculos/${s(a.curriculoId)}`,
      corpo: corpo(a, ['markdown', 'rotulo']),
    }),
  },
  {
    nome: 'definir_proximo_passo',
    efeito: 'escrita',
    descricao:
      'Cria uma acao de agenda, nao redige mensagens nem consulta geracao; a API normaliza tipo e exige Etapa 3 para acoes externas',
    parametros: {
      oportunidadeId: 'id da oportunidade',
      titulo: 'texto',
      tipo: `enum obrigatorio; use exatamente um valor literal: ${TIPOS_ACAO_OPORTUNIDADE.join(' | ')}`,
      venceEm: 'data ISO opcional',
      lembrarEm: 'data ISO opcional',
      principal: 'true | false',
    },
    resumo: (a) => `Definir o proximo passo: ${s(a.titulo)}`,
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/acoes`,
      corpo: corpo(a, ['titulo', 'tipo', 'venceEm', 'lembrarEm', 'principal']),
    }),
  },
  {
    nome: 'concluir_passo',
    efeito: 'escrita',
    descricao: 'Conclui uma acao',
    parametros: { acaoId: 'id da acao' },
    resumo: () => 'Concluir o passo',
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/acoes/${s(a.acaoId)}/concluir`,
    }),
  },
  {
    nome: 'mover_estagio',
    efeito: 'escrita',
    descricao: 'Move a oportunidade para outro estagio do pipeline',
    parametros: {
      oportunidadeId: 'id da oportunidade',
      destino:
        'PREPARACAO | INSCRITA | EM_PROCESSO | ENTREVISTA | OFERTA | REJEITADA | DESISTIU | ARQUIVADA | REABRIR',
      motivo: 'texto opcional',
    },
    resumo: (a) => `Mover a oportunidade para ${s(a.destino)}`,
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/transicoes`,
      corpo: corpo(a, ['destino', 'motivo']),
    }),
  },
  {
    nome: 'registrar_candidatura',
    efeito: 'escrita',
    descricao: 'Registra a candidatura, depois que o candidato se inscreveu',
    parametros: { vagaId: 'id da vaga', curriculoId: 'id do curriculo opcional' },
    resumo: () => 'Registrar a candidatura',
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: '/candidaturas',
      corpo: corpo(a, ['vagaId', 'curriculoId']),
    }),
  },
  {
    nome: 'atualizar_candidatura',
    efeito: 'escrita',
    descricao: 'Atualiza status, notas ou curriculo de uma candidatura',
    parametros: {
      candidaturaId: 'id da candidatura',
      status: 'status opcional',
      notas: 'texto opcional',
      curriculoId: 'id do curriculo opcional',
    },
    resumo: () => 'Atualizar a candidatura',
    requisicao: (a) => ({
      metodo: 'PATCH',
      caminho: `/candidaturas/${s(a.candidaturaId)}`,
      corpo: corpo(a, ['status', 'notas', 'curriculoId']),
    }),
  },
  {
    nome: 'registrar_nota',
    efeito: 'escrita',
    descricao: 'Registra uma nota no historico da oportunidade',
    parametros: { oportunidadeId: 'id da oportunidade', descricao: 'texto da nota' },
    resumo: () => 'Registrar a nota no historico',
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: `/oportunidades/${s(a.oportunidadeId)}/timeline/notas`,
      corpo: corpo(a, ['descricao']),
    }),
  },

  {
    nome: 'redigir_mensagem_recrutador',
    efeito: 'entrega_externa',
    descricao:
      'Depois da Etapa 3, redige a mensagem ao recrutador e entrega o texto para o candidato revisar; nao use definir_proximo_passo para redigir',
    parametros: {
      oportunidadeId: 'id da oportunidade',
      contexto: 'contexto opcional do candidato',
    },
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: '/copiloto/mensagem-recrutador',
      corpo: corpo(a, ['oportunidadeId', 'contexto']),
    }),
  },
  {
    nome: 'redigir_respostas_formulario',
    efeito: 'entrega_externa',
    descricao:
      'Redige respostas de formulario; entrega o texto para o candidato usar',
    parametros: {
      oportunidadeId: 'id da oportunidade',
      campos: 'lista de campos do formulario',
    },
    requisicao: (a) => ({
      metodo: 'POST',
      caminho: '/copiloto/respostas-formulario',
      corpo: corpo(a, ['oportunidadeId', 'campos']),
    }),
  },
];

export const TOOLS_POR_NOME = new Map(TOOLS.map((t) => [t.nome, t]));

export const CATALOGO_TOOLS = TOOLS.map((t) => ({
  nome: t.nome,
  efeito: t.efeito,
  descricao: t.descricao,
  parametros: t.parametros as Record<string, unknown>,
}));
