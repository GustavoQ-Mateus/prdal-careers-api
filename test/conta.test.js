const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
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

test('exclusao recusa senha errada com 403 e pode ser cancelada', async () => {
  const usuario = { senhaHash: await bcrypt.hash('senha-correta-123', 4), exclusaoAgendadaPara: null };
  const prisma = { usuario: {
    findUnique: async () => usuario,
    updateMany: async ({ where, data }) => {
      if (where.exclusaoAgendadaPara === null && usuario.exclusaoAgendadaPara) return { count: 0 };
      Object.assign(usuario, data);
      return { count: 1 };
    },
  } };
  const conta = new ContaService(prisma, {}, {});
  await assert.rejects(conta.agendarExclusao('u1', 'senha-errada'), (erro) => erro.getStatus() === 403 && erro.getResponse().codigo === 'senha_incorreta');
  const primeira = await conta.agendarExclusao('u1', 'senha-correta-123');
  assert.equal((await conta.agendarExclusao('u1', 'senha-correta-123')).exclusaoAgendadaPara, primeira.exclusaoAgendadaPara);
  await conta.cancelarExclusao('u1');
  assert.equal(usuario.exclusaoAgendadaPara, null);
  await conta.cancelarExclusao('u1');
});
