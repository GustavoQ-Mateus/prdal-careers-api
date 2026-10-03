const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { subirAuth } = require('./helpers/auth-app');

const post = (url, rota, email, senha) =>
  fetch(`${url}/auth/${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });

test('cadastro exige senha com pelo menos 10 caracteres', async (t) => {
  const { url, prisma } = await subirAuth(t);
  for (const senha of ['123456', '123456789']) {
    const r = await post(url, 'register', `curta${senha.length}@teste.dev`, senha);
    assert.equal(r.status, 400);
    assert.match(JSON.stringify(await r.json()), /pelo menos 10 caracteres/);
  }
  assert.equal((await post(url, 'register', 'longa@teste.dev', '1234567890')).status, 201);
  assert.equal(prisma.usuarios.length, 1);
});

test('cadastro com email existente responde igual a um cadastro novo', async (t) => {
  const usuarios = [{ id: 'vitima', email: 'vitima@teste.dev', senhaHash: await bcrypt.hash('senha-original-123', 4), criadoEm: new Date() }];
  const { url } = await subirAuth(t, { usuarios });

  const novo = await post(url, 'register', 'nova@teste.dev', 'senha-nova-1234');
  const existente = await post(url, 'register', 'VITIMA@teste.dev', 'senha-do-atacante');
  assert.equal(existente.status, novo.status);
  assert.deepEqual(await existente.json(), await novo.json());
  assert.deepEqual(usuarios.map((u) => u.email), ['vitima@teste.dev', 'nova@teste.dev']);

  assert.equal((await post(url, 'login', 'vitima@teste.dev', 'senha-do-atacante')).status, 401);
  assert.equal((await post(url, 'login', 'vitima@teste.dev', 'senha-original-123')).status, 201);
});

test('conta existente com senha curta continua entrando, sem diferenca de caixa no email', async (t) => {
  const usuarios = [{ id: 'antiga', email: 'antiga@teste.dev', senhaHash: await bcrypt.hash('123456', 4), criadoEm: new Date() }];
  const { url } = await subirAuth(t, { usuarios });
  const r = await post(url, 'login', ' Antiga@Teste.dev ', '123456');
  assert.equal(r.status, 201);
  const corpo = await r.json();
  assert.equal(corpo.usuario.email, 'antiga@teste.dev');
  assert.equal(corpo.accessToken, undefined);
  assert.ok(r.headers.getSetCookie().some((c) => c.startsWith('prdal_access=')));
  assert.equal((await post(url, 'login', 'nao-existe@teste.dev', '123456')).status, 401);
});
