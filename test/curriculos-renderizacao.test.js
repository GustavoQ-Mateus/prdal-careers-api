const assert = require('node:assert/strict');
const test = require('node:test');
const { ServiceUnavailableException } = require('@nestjs/common');
const { CurriculosService, DEGRADACAO_RENDERIZACAO } = require('../dist/curriculos/curriculos.service');

const analise = { score: 70, keywordsEncontradas: [], keywordsCriticasAusentes: [], pontosEliminatorios: [], veredicto: 'ok', breakdown: {} };

function docClientFalhando() {
  const falhar = async () => { throw new Error('connect ECONNREFUSED doc-service'); };
  return { renderPdf: falhar, renderDocx: falhar };
}

function prismaDaGeracao(criados) {
  const geracao = {
    id: 'job-1',
    status: 'PENDENTE',
    usuarioId: 'usuario-1',
    vagaId: 'vaga-1',
    vaga: { titulo: 'Dev', empresa: 'Acme', descricao: 'Java', keywordsStatus: 'VALIDAS', keywords: [{ termo: 'Java', peso: 1 }] },
  };
  const tx = {
    curriculo: { create: async ({ data }) => { criados.curriculo = data; } },
    geracaoCurriculo: { update: async ({ data }) => { criados.geracao = { ...criados.geracao, ...data }; } },
  };
  return {
    geracaoCurriculo: {
      findUnique: async () => geracao,
      update: async ({ data }) => { criados.geracao = { ...criados.geracao, ...data }; },
    },
    perfilMestre: { findUnique: async () => ({ usuarioId: 'usuario-1', nome: 'Pessoa' }) },
    curriculo: { count: async () => 0, findFirst: async () => null },
    $transaction: async (fn) => fn(tx),
  };
}

test('falha do doc-service conclui o curriculo com degradacao explicita e sem arquivos', async () => {
  const criados = {};
  const ai = {
    contextQuery: async () => ({ chunks: [] }),
    generateCvPipeline: async () => ({ markdown: '# Pessoa', analiseInicial: analise, analiseFinal: analise, degradacao: null }),
  };
  const eventos = { registrar: async () => {} };
  const service = new CurriculosService(prismaDaGeracao(criados), ai, docClientFalhando(), eventos, null);

  await service.processar('job-1');

  assert.equal(criados.geracao.status, 'CONCLUIDA');
  assert.equal(criados.curriculo.docxPath, null);
  assert.equal(criados.curriculo.pdfPath, null);
  assert.equal(criados.curriculo.degradacao, DEGRADACAO_RENDERIZACAO);
  assert.equal(criados.geracao.degradacao, DEGRADACAO_RENDERIZACAO);
});

test('gerar arquivos novamente mantem a degradacao e responde 503 quando o doc-service segue fora', async () => {
  const atualizacoes = [];
  const prisma = {
    curriculo: {
      findFirst: async () => ({ id: 'cv-1', markdown: '# Pessoa', degradacao: DEGRADACAO_RENDERIZACAO }),
      update: async ({ data }) => { atualizacoes.push(data); },
    },
  };
  const service = new CurriculosService(prisma, null, docClientFalhando(), null, null);

  await assert.rejects(service.gerarArquivos('usuario-1', 'cv-1'), (err) => err instanceof ServiceUnavailableException);
  assert.equal(atualizacoes[0].degradacao, DEGRADACAO_RENDERIZACAO);
  assert.equal(atualizacoes[0].docxPath, null);
});
