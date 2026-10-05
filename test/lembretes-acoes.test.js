const assert = require('node:assert/strict');
const test = require('node:test');
const { AcoesService } = require('../dist/acoes/acoes.service');
const { OportunidadesController } = require('../dist/oportunidades/oportunidades.controller');

test('criar, mudar, concluir e cancelar criam job na transacao', async () => {
  const jobs = [];
  const enfileirados = [];
  let acao = null;
  const tx = {
    acaoOportunidade: {
      updateMany: async () => {},
      create: async ({ data }) => { acao = { id: 'a1', ...data, concluidaEm: null, canceladaEm: null }; return acao; },
      update: async ({ data }) => { acao = { ...acao, ...data }; return acao; },
    },
  };
  const prisma = { $transaction: async (fn) => fn(tx), acaoOportunidade: { findFirst: async () => acao } };
  const eventos = { registrar: async () => {} };
  const oportunidades = { garantirVaga: async () => {} };
  const fila = { criar: async (transacao, dados) => { assert.equal(transacao, tx); jobs.push(dados); return { id: `j${jobs.length}`, tipo: dados.tipo }; }, enfileirar: async (itens) => enfileirados.push(...itens) };
  const servico = new AcoesService(prisma, eventos, oportunidades, fila);
  await servico.criar('u1', 'v1', { titulo: 'Responder', tipo: 'OUTRO', lembrarEm: '2026-10-06T12:00:00Z' });
  await servico.atualizar('u1', 'a1', { lembrarEm: '2026-10-07T12:00:00Z' });
  await servico.concluir('u1', 'a1');
  acao = { ...acao, concluidaEm: null };
  await servico.cancelar('u1', 'a1');
  assert.equal(jobs.length, 4);
  assert.ok(jobs.every((job) => job.tipo === 'sincronizar_lembrete' && job.referenciaId === 'a1'));
  assert.equal(enfileirados.length, 4);
});

test('rota sincrona de reprocessamento nao existe', () => {
  assert.equal(OportunidadesController.prototype.reprocessarKeywords, undefined);
});
