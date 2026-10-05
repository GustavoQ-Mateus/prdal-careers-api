const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { subirAuth } = require('./helpers/auth-app');

const SENHA = 'senha-do-atacante-123';

async function subir(t) {
  const usuarios = [{ id: 'atacante', email: 'atacante@teste.dev', senhaHash: await bcrypt.hash(SENHA, 4), criadoEm: new Date() }];
  return subirAuth(t, { usuarios });
}

function entrar(nav, origem) {
  const cabecalhos = origem === undefined ? {} : { 'Sec-Fetch-Site': origem };
  return nav.chamar('/auth/login', { metodo: 'POST', csrf: false, cabecalhos, corpo: { email: 'atacante@teste.dev', senha: SENHA } });
}

test('login vindo de outro site e recusado sem gravar cookie de sessao', async (t) => {
  const { navegador } = await subir(t);
  const nav = navegador();
  const r = await entrar(nav, 'cross-site');
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { erro: { codigo: 'origem_recusada', mensagem: 'requisicao de outro site recusada', requestId: null } });
  assert.deepEqual(r.headers.getSetCookie(), []);
  assert.equal(nav.jarra.size, 0);
});

test('login do mesmo site, da mesma origem, digitado ou sem o header segue normal', async (t) => {
  const { navegador } = await subir(t);
  for (const origem of ['same-origin', 'same-site', 'none', undefined]) {
    assert.equal((await entrar(navegador(), origem)).status, 201, String(origem));
  }
});

test('cadastro e refresh vindos de outro site tambem sao recusados', async (t) => {
  const { navegador, prisma } = await subir(t);
  const nav = navegador();
  const cruzado = { 'Sec-Fetch-Site': 'cross-site' };
  const cadastro = await nav.chamar('/auth/register', { metodo: 'POST', csrf: false, cabecalhos: cruzado, corpo: { email: 'nova@teste.dev', senha: 'senha-forte-123' } });
  assert.equal(cadastro.status, 403);
  assert.equal(prisma.usuarios.length, 1);

  assert.equal((await entrar(nav)).status, 201);
  const refresh = await nav.chamar('/auth/refresh', { metodo: 'POST', csrf: false, cabecalhos: cruzado });
  assert.equal(refresh.status, 403);
  assert.deepEqual(refresh.headers.getSetCookie(), []);
  assert.ok(prisma.sessoes.every((s) => !s.substituidaEm && !s.revogadaEm));
  assert.equal((await nav.chamar('/auth/refresh', { metodo: 'POST', csrf: false, cabecalhos: { 'Sec-Fetch-Site': 'same-origin' } })).status, 200);
});

test('com API_PREFIXO o bloqueio de outro site vale nas rotas prefixadas', async (t) => {
  process.env.API_PREFIXO = '/api';
  t.after(() => delete process.env.API_PREFIXO);
  const { navegador } = await subir(t);
  const corpo = { email: 'atacante@teste.dev', senha: SENHA };
  const nav = navegador();
  assert.equal((await nav.chamar('/api/auth/login', { metodo: 'POST', csrf: false, cabecalhos: { 'Sec-Fetch-Site': 'cross-site' }, corpo })).status, 403);
  assert.equal((await nav.chamar('/api/auth/login', { metodo: 'POST', csrf: false, cabecalhos: { 'Sec-Fetch-Site': 'same-origin' }, corpo })).status, 201);
});
