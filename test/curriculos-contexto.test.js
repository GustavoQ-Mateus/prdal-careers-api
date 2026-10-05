const { ArmazenamentoMemoria } = require('./helpers/armazenamento');
const assert = require('node:assert/strict');
const test = require('node:test');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');

const analise = { score: 70, keywordsEncontradas: [], keywordsCriticasAusentes: [], pontosEliminatorios: [], veredicto: 'ok', breakdown: {} };

function prisma(criados) {
  const geracao = {
    id: 'job-1',
    status: 'PENDENTE',
    usuarioId: 'usuario-1',
    vagaId: 'vaga-1',
    vaga: {
      titulo: 'Analista de Dados',
      empresa: 'Acme',
      descricao: 'Sobre a empresa: somos lideres de mercado. Requisitos: SQL e Power BI.',
      keywordsStatus: 'VALIDAS',
      keywords: [{ termo: 'Excel', peso: 0.4 }, { termo: 'SQL', peso: 1 }, { termo: 'Power BI', peso: 0.8 }],
    },
  };
  const tx = {
    curriculo: { create: async ({ data }) => { criados.curriculo = data; } },
    geracaoCurriculo: { update: async () => {} },
  };
  return {
    geracaoCurriculo: { findUnique: async () => geracao, update: async () => {} },
    perfilMestre: { findUnique: async () => ({ usuarioId: 'usuario-1', nome: 'Pessoa' }) },
    curriculo: { count: async () => 0, findFirst: async () => null },
    $transaction: async (fn) => fn(tx),
  };
}

test('o rag e consultado pelas keywords da vaga, nao pelo texto da vaga, e as fontes seguem tipadas', async () => {
  const criados = {};
  const consultas = [];
  const payloads = [];
  const fonte = { id: 'n1', tipo: 'nota', factual: false, titulo: 'Planos', texto: 'quero estudar Kubernetes' };
  const ai = {
    recuperar: async (usuarioId, consulta) => {
      consultas.push([usuarioId, consulta]);
      return { chunks: [fonte] };
    },
    generateCvPipeline: async (payload) => {
      payloads.push(payload);
      return { markdown: '# Pessoa', analiseInicial: analise, analiseFinal: analise, degradacao: null };
    },
  };
  const falhar = async () => { throw new Error('doc-service fora'); };
  const doc = { renderPdf: falhar, renderDocx: falhar };
  const service = new CurriculosService(prisma(criados), ai, doc, { registrar: async () => {} }, null, null, ai, new ArmazenamentoMemoria());
  await service.processar('job-1');

  assert.deepEqual(consultas, [['usuario-1', ['SQL', 'Power BI', 'Excel']]]);
  assert.deepEqual(payloads[0].contexto, [fonte]);
});

test('armazenamento de vetores fora gera com degradacao explicita, nunca contexto vazio em silencio', async () => {
  const { DEGRADACAO_CONTEXTO } = require('../dist/curriculos/curriculos.service');
  const criados = {};
  const payloads = [];
  const atualizacoes = [];
  const banco = prisma(criados);
  banco.geracaoCurriculo.update = async ({ data }) => { atualizacoes.push(data); };
  const ai = {
    recuperar: async () => { throw new Error('connect ECONNREFUSED ai-service:8000'); },
    generateCvPipeline: async (payload) => {
      payloads.push(payload);
      return { markdown: '# Pessoa', analiseInicial: analise, analiseFinal: analise, degradacao: null };
    },
  };
  const ok = async () => Buffer.from('%PDF /Type /Page');
  const doc = { renderPdf: ok, renderDocx: ok };
  const service = new CurriculosService(banco, ai, doc, { registrar: async () => {} }, null, null, ai, new ArmazenamentoMemoria());
  const avisos = [];
  service.logger.warn = (mensagem) => avisos.push(mensagem);
  await service.processar('job-1');

  assert.deepEqual(payloads[0].contexto, []);
  assert.equal(criados.curriculo.degradacao, DEGRADACAO_CONTEXTO);
  assert.ok(atualizacoes.some((data) => data.degradacao === DEGRADACAO_CONTEXTO));
  assert.ok(avisos.some((m) => /degradacao codigo=contexto_rag_indisponivel .*ECONNREFUSED/.test(m)));
});

test('degradacao do contexto se soma a da reescrita sem perder nenhuma', async () => {
  const { DEGRADACAO_CONTEXTO } = require('../dist/curriculos/curriculos.service');
  const criados = {};
  const ai = {
    recuperar: async () => { throw new Error('fora'); },
    generateCvPipeline: async () => ({ markdown: '# Pessoa', analiseInicial: analise, analiseFinal: analise, degradacao: 'A reescrita está indisponível no momento.' }),
  };
  const ok = async () => Buffer.from('%PDF /Type /Page');
  const service = new CurriculosService(prisma(criados), ai, { renderPdf: ok, renderDocx: ok }, { registrar: async () => {} }, null, null, ai, new ArmazenamentoMemoria());
  service.logger.warn = () => {};
  await service.processar('job-1');
  assert.equal(criados.curriculo.degradacao, `${DEGRADACAO_CONTEXTO}; A reescrita está indisponível no momento.`);
});
