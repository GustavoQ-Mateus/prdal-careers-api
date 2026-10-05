require('./helpers/armazenamento');
const assert = require('node:assert/strict');
const test = require('node:test');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');

const analise = { score: 70, keywordsEncontradas: [], keywordsCriticasAusentes: [], pontosEliminatorios: [], veredicto: 'ok', breakdown: {} };

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

function docUmaPagina() {
  return {
    renderPdf: async () => ({ path: '/tmp/cv.pdf', paginas: 1 }),
    renderDocx: async () => ({ path: '/tmp/cv.docx' }),
  };
}

async function gerar(pipeline) {
  const criados = {};
  const chamadas = [];
  const ai = {
    recuperar: async () => ({ chunks: [], degradacao: null }),
    generateCvPipeline: async (payload, opcoes) => {
      chamadas.push(opcoes);
      return { markdown: '# Pessoa', analiseInicial: analise, analiseFinal: analise, degradacao: null, ...pipeline };
    },
  };
  const service = new CurriculosService(prismaDaGeracao(criados), ai, docUmaPagina(), { registrar: async () => {} }, null, null, ai);
  await service.processar('job-1');
  return { criados, chamadas };
}

test('o curriculo grava o modelo e a versao do prompt que o geraram', async () => {
  const { criados, chamadas } = await gerar({ modelo: 'claude-sonnet-5', promptVersion: 'reescrita.v1' });

  assert.equal(criados.geracao.status, 'CONCLUIDA');
  assert.equal(criados.curriculo.modelo, 'claude-sonnet-5');
  assert.equal(criados.curriculo.promptVersion, 'reescrita.v1');
  assert.deepEqual(chamadas, [{ operacao: 'geracao:job-1', usuarioId: 'usuario-1' }]);
});

test('sem chamada ao modelo o curriculo fica sem modelo e mantem a versao do prompt', async () => {
  const { criados } = await gerar({ modelo: null, promptVersion: 'reescrita.v1' });

  assert.equal(criados.curriculo.modelo, null);
  assert.equal(criados.curriculo.promptVersion, 'reescrita.v1');
});
