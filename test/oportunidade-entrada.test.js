require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { SEM_PG, prismaDoBanco, novoUsuario } = require('./helpers/postgres');

function servico(prisma) {
  const { OportunidadesService } = require('../dist/oportunidades/oportunidades.service');
  const { EventosService } = require('../dist/eventos/eventos.service');
  const { JobsService } = require('../dist/jobs/jobs.service');
  const { LotesService } = require('../dist/lotes/lotes.service');
  const enviados = [];
  const jobs = new JobsService(prisma, { enviar: async (mensagem) => enviados.push(mensagem) });
  const ia = { classify: async () => { throw new Error('sem ia'); } };
  return { enviados, oportunidades: new OportunidadesService(prisma, ia, new EventosService(), jobs, new LotesService(prisma, jobs)) };
}

const item = (titulo, empresa) => ({ titulo, empresa, descricao: `descricao de ${titulo}` });

test('importacao cria oportunidades em entrada, so classifica no lote e lista com busca literal e paginacao', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { oportunidades, enviados } = servico(prisma);
  const usuario = await novoUsuario(prisma);
  const { loteId, total } = await oportunidades.importar(usuario.id, {
    itens: [item('Bonus de 50% em C++', 'A'), item('Bonus de 500 reais', 'B'), item('Analista', 'c++ LTDA')],
  });
  assert.equal(total, 3);
  const vagas = await prisma.vaga.findMany({ where: { usuarioId: usuario.id } });
  assert.deepEqual([...new Set(vagas.map((v) => `${v.estagio}:${v.origem}:${v.keywordsStatus}`))], ['ENTRADA:IMPORTACAO:PENDENTE']);
  const itens = await prisma.loteItem.findMany({ where: { loteId } });
  assert.deepEqual(itens.map((i) => i.vagaId).sort(), vagas.map((v) => v.id).sort());
  assert.deepEqual([...new Set(enviados.map((m) => m.tipo))], ['importar_lote']);
  assert.equal(await prisma.job.count({ where: { usuarioId: usuario.id, tipo: 'extrair_keywords' } }), 0);

  const porcento = await oportunidades.listar(usuario.id, { visao: 'entrada', busca: '50%' });
  assert.deepEqual(porcento.itens.map((i) => i.titulo), ['Bonus de 50% em C++']);
  assert.deepEqual(porcento.itens[0].apresentacao, 'ENTRADA');
  assert.deepEqual(porcento.itens[0].tipo, 'ENTRADA');
  const cmais = await oportunidades.listar(usuario.id, { visao: 'entrada', busca: 'C++' });
  assert.equal(cmais.itens.length, 2);
  const pagina = await oportunidades.listar(usuario.id, { visao: 'entrada', limit: 2, offset: 0 });
  assert.deepEqual([pagina.itens.length, pagina.total, pagina.limit, pagina.offset], [2, 3, 2, 0]);
  assert.equal((await oportunidades.listar(usuario.id, { visao: 'ativas' })).total, 0);
  assert.equal((await oportunidades.listar(usuario.id, { visao: 'ativas', limit: 10 })).total, 0);
});

test('ativar entrada muda o estagio no mesmo id, grava o evento, pede keywords e e idempotente', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { oportunidades } = servico(prisma);
  const usuario = await novoUsuario(prisma);
  await oportunidades.importar(usuario.id, { itens: [item('Dev', 'Acme')] });
  const entrada = await prisma.vaga.findFirstOrThrow({ where: { usuarioId: usuario.id } });

  await assert.rejects(oportunidades.transicionar(usuario.id, entrada.id, 'INSCRITA'), /ative a entrada/);
  await assert.rejects(oportunidades.ativarEntrada(novoId(), entrada.id), /nao encontrada/);

  const ativada = await oportunidades.ativarEntrada(usuario.id, entrada.id);
  assert.equal(ativada.id, entrada.id);
  assert.equal(ativada.estagio, 'ATIVA');
  const eventos = await prisma.eventoOportunidade.findMany({ where: { vagaId: entrada.id } });
  assert.deepEqual(eventos.map((e) => e.tipo), ['OPORTUNIDADE_ATIVADA']);
  assert.equal(await prisma.job.count({ where: { referenciaId: entrada.id, tipo: 'extrair_keywords' } }), 1);

  const denovo = await oportunidades.ativarEntrada(usuario.id, entrada.id);
  assert.equal(denovo.id, entrada.id);
  assert.equal(await prisma.eventoOportunidade.count({ where: { vagaId: entrada.id } }), 1);
  assert.equal(await prisma.job.count({ where: { referenciaId: entrada.id, tipo: 'extrair_keywords' } }), 1);
  assert.equal((await oportunidades.listar(usuario.id, { visao: 'entrada' })).total, 0);
  const ativas = await oportunidades.listar(usuario.id, { visao: 'ativas' });
  assert.deepEqual(ativas.itens.map((i) => [i.id, i.apresentacao]), [[entrada.id, 'ATIVA']]);
});

function novoId() {
  return require('node:crypto').randomUUID();
}
