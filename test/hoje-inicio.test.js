const assert = require('node:assert/strict');
const test = require('node:test');
const { SEM_PG, prismaDoBanco, novoUsuario } = require('./helpers/postgres');

const FUSO = 'Pacific/Kiritimati';
const MINUTO = 60 * 1000;

function hojeDe(prisma) {
  const { HojeService } = require('../dist/hoje/hoje.service');
  return new HojeService(prisma);
}

async function preparar(prisma) {
  const usuario = await novoUsuario(prisma);
  await prisma.preferenciaUsuario.create({ data: { usuarioId: usuario.id, fusoHorario: FUSO } });
  return usuario;
}

async function geracao(prisma, usuarioId, { titulo, quando, status = 'CONCLUIDA', score = 70 }) {
  const vaga = await prisma.vaga.create({ data: { usuarioId, titulo, empresa: `Empresa ${titulo}`, descricao: 'd', keywords: [] } });
  const curriculo = await prisma.curriculo.create({ data: { vagaId: vaga.id, markdown: '# cv', score } });
  const criada = await prisma.geracaoCurriculo.create({ data: { usuarioId, vagaId: vaga.id, curriculoId: curriculo.id, status } });
  await prisma.$executeRaw`UPDATE geracoes_curriculo SET atualizado_em = ${quando} WHERE id = ${criada.id}`;
  return { vaga, curriculo };
}

test('geracoes concluidas contam os ultimos 7 dias no fuso do usuario e deixam de fora a de 8 dias', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { dataCivil, adicionarDiasCivis, limitesDoDia } = require('../dist/dominio/fuso');
  const usuario = await preparar(prisma);
  const hoje = dataCivil(new Date(), FUSO);
  const { inicio } = limitesDoDia(adicionarDiasCivis(hoje, -6), FUSO);
  const borda = await geracao(prisma, usuario.id, { titulo: 'Borda', quando: new Date(inicio.getTime() + MINUTO), score: 88 });
  await geracao(prisma, usuario.id, { titulo: 'Antes da borda', quando: new Date(inicio.getTime() - MINUTO) });
  await geracao(prisma, usuario.id, { titulo: 'Oito dias', quando: new Date(Date.now() - 8 * 24 * 60 * MINUTO) });
  await geracao(prisma, usuario.id, { titulo: 'Com erro', quando: new Date(), status: 'ERRO' });
  const recente = await geracao(prisma, usuario.id, { titulo: 'Recente', quando: new Date(Date.now() - MINUTO), score: null });
  const outro = await preparar(prisma);
  await geracao(prisma, outro.id, { titulo: 'De outro', quando: new Date() });

  const resposta = await hojeDe(prisma).agenda(usuario.id);
  assert.equal(resposta.fusoHorario, FUSO);
  assert.deepEqual(resposta.geracoesConcluidas.map((g) => g.titulo), ['Recente', 'Borda']);
  assert.deepEqual(resposta.geracoesConcluidas[1], {
    curriculoId: borda.curriculo.id,
    oportunidadeId: borda.vaga.id,
    titulo: 'Borda',
    empresa: 'Empresa Borda',
    score: 88,
    concluidaEm: new Date(inicio.getTime() + MINUTO),
  });
  assert.equal(resposta.geracoesConcluidas[0].score, null);
  assert.equal(resposta.geracoesConcluidas[0].curriculoId, recente.curriculo.id);
  assert.deepEqual(resposta.entrada, []);
});

test('no maximo cinco de cada, da mais nova para a mais antiga, e entrada so com oportunidade em entrada', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const usuario = await preparar(prisma);
  const vazio = await hojeDe(prisma).agenda(usuario.id);
  assert.deepEqual([vazio.geracoesConcluidas, vazio.entrada], [[], []]);

  for (let i = 1; i <= 6; i += 1) {
    await geracao(prisma, usuario.id, { titulo: `G${i}`, quando: new Date(Date.now() - i * MINUTO) });
    await prisma.vaga.create({
      data: { usuarioId: usuario.id, titulo: `E${i}`, empresa: 'Acme', descricao: 'd', keywords: [], estagio: 'ENTRADA', origem: 'IMPORTACAO', criadoEm: new Date(Date.now() - i * MINUTO) },
    });
  }
  const resposta = await hojeDe(prisma).agenda(usuario.id);
  assert.deepEqual(resposta.geracoesConcluidas.map((g) => g.titulo), ['G1', 'G2', 'G3', 'G4', 'G5']);
  assert.deepEqual(resposta.entrada.map((e) => e.titulo), ['E1', 'E2', 'E3', 'E4', 'E5']);
  assert.deepEqual(Object.keys(resposta.entrada[0]).sort(), ['criadoEm', 'empresa', 'id', 'titulo']);
  assert.ok(resposta.semProximoPasso.every((v) => !v.titulo.startsWith('E')));
});
