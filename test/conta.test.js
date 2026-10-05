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
