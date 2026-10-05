require('./helpers/armazenamento');
const assert = require('node:assert/strict');
const test = require('node:test');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');

const analise = { score: 70, keywordsEncontradas: [], keywordsCriticasAusentes: [], pontosEliminatorios: [], veredicto: 'ok', breakdown: {} };
const estrutura = { titulo: { texto: 'Dev', fontes: ['e1'] }, resumo: [], experiencias: [], competencias: [], experienciasOmitidas: [] };

function prisma(criados) {
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
    geracaoCurriculo: { findUnique: async () => geracao, update: async () => {} },
    perfilMestre: { findUnique: async () => ({ usuarioId: 'usuario-1', nome: 'Pessoa' }) },
    curriculo: { count: async () => 0, findFirst: async () => null },
    $transaction: async (fn) => fn(tx),
  };
}

function pdf(paginas) {
  return Buffer.from(Array.from({ length: paginas }, () => '/Type /Page\n').join(''));
}

function docComPaginas(porMarkdown) {
  return {
    renderPdf: async (markdown) => pdf(porMarkdown[markdown] ?? 1),
    renderDocx: async () => Buffer.from('docx'),
  };
}

async function gerar(paginasPorMarkdown, reducoes) {
  const criados = {};
  const chamadas = { geracao: 0, cortes: [] };
  const ai = {
    contextQuery: async () => ({ chunks: [] }),
    generateCvPipeline: async () => {
      chamadas.geracao += 1;
      return { markdown: 'longo', estrutura, analiseInicial: analise, analiseFinal: analise, degradacao: null, modelo: 'claude-teste', promptVersion: 'reescrita.v2' };
    },
    reduzirCurriculo: async (payload, opcoes) => {
      chamadas.cortes.push({ nivel: payload.nivel, estrutura: payload.estrutura, opcoes, temContexto: 'contexto' in payload });
      return reducoes[payload.nivel - 1];
    },
  };
  const service = new CurriculosService(prisma(criados), ai, docComPaginas(paginasPorMarkdown), { registrar: async () => {} }, null);
  await service.processar('job-1');
  return { criados, chamadas };
}

test('o corte de pagina re-renderiza a estrutura por nivel sem gerar de novo', async () => {
  const cortada1 = { ...estrutura, experienciasOmitidas: ['a'] };
  const cortada2 = { ...estrutura, experienciasOmitidas: ['a', 'b'] };
  const { criados, chamadas } = await gerar(
    { longo: 2, medio: 2, curto: 1 },
    [
      { markdown: 'medio', estrutura: cortada1, analiseInicial: analise, analiseFinal: analise },
      { markdown: 'curto', estrutura: cortada2, analiseInicial: analise, analiseFinal: { ...analise, score: 65 } },
    ],
  );
  assert.equal(chamadas.geracao, 1);
  assert.deepEqual(chamadas.cortes.map((c) => c.nivel), [1, 2]);
  assert.ok(chamadas.cortes.every((c) => c.estrutura === estrutura && !c.temContexto));
  assert.deepEqual(chamadas.cortes[0].opcoes, { operacao: 'geracao:job-1' });
  assert.equal(criados.curriculo.markdown, 'curto');
  assert.deepEqual(criados.curriculo.estrutura, cortada2);
  assert.equal(criados.curriculo.score, 65);
  assert.equal(criados.curriculo.promptVersion, 'reescrita.v2');
  assert.equal(criados.curriculo.degradacao, null);
});

test('uma pagina de cara grava a estrutura e nao corta', async () => {
  const { criados, chamadas } = await gerar({ longo: 1 }, []);
  assert.deepEqual(chamadas.cortes, []);
  assert.deepEqual(criados.curriculo.estrutura, estrutura);
});

test('corte que nao muda o texto encerra o laco e registra as paginas', async () => {
  const { criados, chamadas } = await gerar(
    { longo: 2 },
    [{ markdown: 'longo', estrutura, analiseInicial: analise, analiseFinal: analise }],
  );
  assert.deepEqual(chamadas.cortes.map((c) => c.nivel), [1]);
  assert.match(criados.curriculo.degradacao, /2 paginas/);
});
