const assert = require('node:assert/strict');
const test = require('node:test');
const { conferirEmails } = require('../dist/scripts/migrar-emails');

test('preflight lista colisoes sem alterar contas', async () => {
  const contas = [
    { id: '1', email: ' Pessoa@Teste.dev ' },
    { id: '2', email: 'pessoa@teste.dev' },
    { id: '3', email: 'outra@teste.dev' },
  ];
  const relatorio = await conferirEmails({ usuario: { findMany: async () => contas } });
  assert.equal(relatorio.total, 3);
  assert.equal(relatorio.naoNormalizados, 1);
  assert.deepEqual(relatorio.colisoes, [{ email: 'pessoa@teste.dev', contas: contas.slice(0, 2) }]);
  assert.equal(contas[0].email, ' Pessoa@Teste.dev ');
});
