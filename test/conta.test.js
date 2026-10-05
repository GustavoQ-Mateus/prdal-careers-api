const assert = require('node:assert/strict');
const test = require('node:test');
const { ContaService, PROVEDOR_PADRAO, REGIAO_PADRAO } = require('../dist/conta/conta.service');

test('conta apresenta consentimento nulo e prazo nulo para conta existente', async () => {
  const conta = new ContaService({ usuario: { findUnique: async () => ({ email: 'pessoa@teste.dev', consentimentoLlmEm: null, exclusaoAgendadaPara: null }) } });
  assert.deepEqual(await conta.buscar('1'), {
    email: 'pessoa@teste.dev',
    consentimento: { aceitoEm: null, provedor: PROVEDOR_PADRAO, regiao: REGIAO_PADRAO },
    exclusaoAgendadaPara: null,
  });
});

test('exportacao reaproveita job ativo e oculta job de outra conta', async () => {
  const job = { id: 'j1', usuarioId: 'u1', tipo: 'exportar_dados', status: 'PENDENTE' };
  const prisma = { job: {
    findFirst: async ({ where }) => where.usuarioId === 'u1' ? job : null,
  } };
  const enfileirados = [];
  const jobs = { enfileirar: async (itens) => { enfileirados.push(...itens); } };
  const conta = new ContaService(prisma, jobs, {});
  assert.deepEqual(await conta.exportar('u1'), { jobId: 'j1' });
  assert.deepEqual(await conta.exportar('u1'), { jobId: 'j1' });
  assert.equal(enfileirados.length, 2);
  await assert.rejects(conta.statusExportacao('u2', 'j1'), { status: 404 });
});
