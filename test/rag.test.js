const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { SEM_PG, prismaDoBanco, novoUsuario } = require('./helpers/postgres');
const { RagService, consultasUnicas, TETO_CONSULTAS, TETO_CHUNKS, DEGRADACAO_REINDEXACAO } = require('../dist/rag/rag.service');

const MODELO = 'intfloat/multilingual-e5-small';

function encontrado(fonteId, similaridade, extra = {}) {
  return { consulta: 1, fonteId, texto: `texto ${fonteId}`, tipo: 'nota', factual: false, titulo: fonteId, origem: 'nota', similaridade, ...extra };
}

function rag({ encontrados = [], limiar = 0.86, dimensao = 384, deOutroModelo = 0 } = {}) {
  const chamadas = { consultas: [], buscas: [] };
  const ai = {
    embeddingConsultas: async (consultas) => {
      chamadas.consultas.push(consultas);
      return { modelo: MODELO, dimensao, limiar, vetores: consultas.map(() => [1]) };
    },
  };
  const vetores = {
    exigirDimensao: async (d) => {
      if (d !== 384) throw new Error(`o embedding veio com ${d} dimensoes e o banco guarda 384`);
    },
    buscar: async (...args) => {
      chamadas.buscas.push(args);
      return encontrados;
    },
    contarDeOutroModelo: async () => deOutroModelo,
  };
  return { servico: new RagService(ai, vetores), chamadas };
}

test('consultas repetidas, vazias ou alem do teto nao vao ao embedding', async () => {
  assert.deepEqual(consultasUnicas(['SQL', ' sql ', '', '  ', 'Power BI']), ['SQL', 'Power BI']);
  const muitas = Array.from({ length: 40 }, (_, i) => `termo ${i}`);
  assert.equal(consultasUnicas(muitas).length, TETO_CONSULTAS);
  const { servico, chamadas } = rag();
  assert.deepEqual(await servico.recuperar('u1', ['', ' ']), { chunks: [], degradacao: null });
  assert.deepEqual(chamadas.consultas, []);
});

test('abaixo do limiar fica de fora, a melhor nota por fonte vale e factual segue separado de apoio', async () => {
  const { servico, chamadas } = rag({
    encontrados: [
      encontrado('exp-a', 0.87, { tipo: 'experiencia', factual: true, origem: 'perfil' }),
      encontrado('exp-a', 0.9, { tipo: 'experiencia', factual: true, origem: 'perfil', consulta: 2 }),
      encontrado('n1#2', 0.861),
      encontrado('n2', 0.859),
      encontrado('n-hist', 0.88, { factual: true }),
    ],
  });
  const { chunks, degradacao } = await servico.recuperar('u1', ['SQL', 'Power BI'], 5);
  assert.equal(degradacao, null);
  assert.deepEqual(chunks.map((c) => [c.id, c.similaridade, c.factual]), [['exp-a', 0.9, true], ['n-hist', 0.88, true], ['n1#2', 0.861, false]]);
  assert.equal(chunks[0].tipo, 'experiencia');
  assert.deepEqual(chamadas.buscas[0].slice(0, 2), ['u1', MODELO]);
  assert.equal(chamadas.buscas[0][3], 5);
});

test('no maximo vinte fontes voltam', async () => {
  const encontrados = Array.from({ length: 30 }, (_, i) => encontrado(`n${i}`, 0.87 + i / 1000));
  const { servico } = rag({ encontrados });
  const { chunks } = await servico.recuperar('u1', ['SQL']);
  assert.equal(chunks.length, TETO_CHUNKS);
  assert.equal(chunks[0].id, 'n29');
});

test('vetor com dimensao diferente da coluna e recusado e chunk de outro modelo vira degradacao', async () => {
  await assert.rejects(rag({ dimensao: 768 }).servico.recuperar('u1', ['SQL']), /768 dimensoes/);
  const { servico } = rag({ encontrados: [encontrado('n1', 0.9)], deOutroModelo: 3 });
  const resultado = await servico.recuperar('u1', ['SQL']);
  assert.equal(resultado.chunks.length, 1);
  assert.equal(resultado.degradacao, DEGRADACAO_REINDEXACAO);
});

test('embedding fora propaga o erro para a geracao degradar', async () => {
  const servico = new RagService({ embeddingConsultas: async () => { throw new Error('connect ECONNREFUSED'); } }, {});
  await assert.rejects(servico.recuperar('u1', ['SQL']), /ECONNREFUSED/);
});

function vetor(...posicoes) {
  const v = new Array(384).fill(0);
  for (const [i, valor] of posicoes) v[i] = valor;
  const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norma);
}

test('pgvector: busca por cosseno filtrada por usuario e modelo, troca de chunks e cascata', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { VetoresRepositorio } = require('../dist/repositorios/vetores.repositorio');
  const repo = new VetoresRepositorio(prisma);
  assert.equal(await repo.conferirDimensao(), 384);
  const [dono, outro] = [await novoUsuario(prisma), await novoUsuario(prisma)];
  const documento = async (usuarioId, origem, tipo, factual) => prisma.documentoRag.create({
    data: { id: randomUUID(), usuarioId, origem, origemId: randomUUID(), tipo, factual, titulo: tipo, texto: 'x' },
  });
  const perfil = await documento(dono.id, 'perfil', 'experiencia', true);
  const nota = await documento(dono.id, 'nota', 'nota', false);
  const alheio = await documento(outro.id, 'nota', 'nota', false);

  await repo.substituir(perfil.id, dono.id, MODELO, [{ indice: 0, fonteId: 'exp-a', texto: 'SQL', vetor: vetor([0, 1]) }]);
  await repo.substituir(nota.id, dono.id, MODELO, [
    { indice: 0, fonteId: 'n1#1', texto: 'quase SQL', vetor: vetor([0, 1], [1, 1]) },
    { indice: 1, fonteId: 'n1#2', texto: 'nada a ver', vetor: vetor([2, 1]) },
  ]);
  await repo.substituir(alheio.id, outro.id, MODELO, [{ indice: 0, fonteId: 'alheio', texto: 'SQL alheio', vetor: vetor([0, 1]) }]);

  const achados = await repo.buscar(dono.id, MODELO, [vetor([0, 1]), vetor([2, 1])], 2);
  assert.deepEqual(achados.filter((a) => a.consulta === 1).map((a) => a.fonteId), ['exp-a', 'n1#1']);
  assert.ok(Math.abs(achados[0].similaridade - 1) < 1e-6);
  assert.ok(Math.abs(achados[1].similaridade - Math.SQRT1_2) < 1e-6);
  assert.equal(achados[0].factual, true);
  assert.equal(achados[0].tipo, 'experiencia');
  assert.deepEqual(achados.filter((a) => a.consulta === 2).map((a) => a.fonteId)[0], 'n1#2');
  assert.ok(achados.every((a) => a.fonteId !== 'alheio'));
  assert.deepEqual(await repo.buscar(dono.id, 'outro-modelo', [vetor([0, 1])], 5), []);

  await repo.substituir(nota.id, dono.id, 'outro-modelo', [{ indice: 0, fonteId: 'n1', texto: 'novo', vetor: vetor([3, 1]) }]);
  assert.equal(await prisma.chunkRag.count({ where: { documentoId: nota.id } }), 1);
  assert.equal(await repo.contarDeOutroModelo(dono.id, MODELO), 1);
  await prisma.documentoRag.delete({ where: { id: nota.id } });
  assert.equal(await repo.contarDeOutroModelo(dono.id, MODELO), 0);
  await assert.rejects(repo.substituir(perfil.id, dono.id, MODELO, [{ indice: 0, fonteId: 'x', texto: 'x', vetor: [1, 0] }]), /dimensions/);
  await assert.rejects(repo.exigirDimensao(768), /768/);
});

test('reindexacao pega so documento sem chunk do modelo atual ou com chunk de outro modelo', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { VetoresRepositorio } = require('../dist/repositorios/vetores.repositorio');
  const { reindexarDesatualizados } = require('../dist/rag/reindexacao');
  const repo = new VetoresRepositorio(prisma);
  const usuario = await novoUsuario(prisma);
  const criar = (texto) => prisma.documentoRag.create({
    data: { id: randomUUID(), usuarioId: usuario.id, origem: 'nota', origemId: randomUUID(), tipo: 'nota', factual: false, titulo: 't', texto },
  });
  const [atual, antigo, semChunk, falha] = [await criar('atual'), await criar('antigo'), await criar('novo'), await criar('falha')];
  await repo.substituir(atual.id, usuario.id, MODELO, [{ indice: 0, fonteId: 'a', texto: 'atual', vetor: vetor([0, 1]) }]);
  await repo.substituir(antigo.id, usuario.id, 'paraphrase-multilingual-MiniLM-L12-v2', [{ indice: 0, fonteId: 'b', texto: 'antigo', vetor: vetor([1, 1]) }]);
  await repo.substituir(falha.id, usuario.id, 'paraphrase-multilingual-MiniLM-L12-v2', [{ indice: 0, fonteId: 'c', texto: 'falha', vetor: vetor([2, 1]) }]);

  const indexados = [];
  const ragFalso = {
    modeloAtual: async () => MODELO,
    indexar: async (documento) => {
      if (documento.texto === 'falha') throw new Error('embedding fora');
      indexados.push(documento.texto);
      await repo.substituir(documento.id, documento.usuarioId, MODELO, [{ indice: 0, fonteId: 'x', texto: documento.texto, vetor: vetor([3, 1]) }]);
      return 1;
    },
  };
  const resultado = await reindexarDesatualizados(prisma, ragFalso, { usuarioId: usuario.id });
  assert.deepEqual(indexados.sort(), ['antigo', 'novo']);
  assert.equal(resultado.reindexados, 2);
  assert.deepEqual(resultado.falhas.map((f) => f.documentoId), [falha.id]);
  assert.equal(await repo.contarDeOutroModelo(usuario.id, MODELO), 1);
  const segunda = await reindexarDesatualizados(prisma, { ...ragFalso, indexar: async () => { throw new Error('fora'); } }, { usuarioId: usuario.id });
  assert.equal(segunda.documentos, 1);
  assert.ok(semChunk);
});
