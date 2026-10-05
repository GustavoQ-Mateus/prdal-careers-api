const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { subirAuth } = require('./helpers/auth-app');

const SENHA = 'senha-forte-da-vitima';

function comPrefixo(t, valor) {
  process.env.API_PREFIXO = valor;
  t.after(() => delete process.env.API_PREFIXO);
}

async function subir(t) {
  const usuarios = [{ id: 'vitima', email: 'vitima@teste.dev', senhaHash: await bcrypt.hash(SENHA, 4), criadoEm: new Date() }];
  return subirAuth(t, { usuarios });
}

test('normaliza API_PREFIXO com ou sem barras', () => {
  const { prefixoApi, semPrefixo } = require('../dist/config/prefixo');
  const sem = { API_VERSAO: '' };
  assert.equal(prefixoApi(sem), '');
  assert.equal(prefixoApi({ ...sem, API_PREFIXO: '  ' }), '');
  for (const valor of ['/api', 'api', '/api/', 'api/']) assert.equal(prefixoApi({ ...sem, API_PREFIXO: valor }), '/api', valor);
  assert.equal(semPrefixo('/auth/login', sem), '/auth/login');
  assert.equal(semPrefixo('/api/auth/login', { ...sem, API_PREFIXO: '/api' }), '/auth/login');
  assert.equal(semPrefixo('/auth/login', { ...sem, API_PREFIXO: '/api' }), null);
  assert.equal(semPrefixo('/apix/auth/login', { ...sem, API_PREFIXO: '/api' }), null);
});

test('com API_PREFIXO=/api login, refresh e csrf seguem o prefixo e /health fica fora dele', async (t) => {
  comPrefixo(t, '/api');
  const { url, navegador } = await subir(t);
  const nav = navegador();

  const login = await nav.chamar('/api/auth/login', { metodo: 'POST', csrf: false, corpo: { email: 'vitima@teste.dev', senha: SENHA } });
  assert.equal(login.status, 201);
  const refresh = nav.jarra.get('prdal_refresh');
  assert.equal(refresh.attrs.path, '/api/auth/refresh');
  assert.equal(nav.jarra.get('prdal_access').attrs.path, '/');

  const antes = refresh.valor;
  const renovada = await nav.chamar('/api/auth/refresh', { metodo: 'POST', csrf: false });
  assert.equal(renovada.status, 200);
  assert.notEqual(nav.jarra.get('prdal_refresh').valor, antes);
  assert.equal(nav.jarra.get('prdal_refresh').attrs.path, '/api/auth/refresh');

  assert.equal((await nav.chamar('/api/protegido/ler')).status, 200);
  assert.equal((await nav.chamar('/api/protegido/escrever', { metodo: 'POST', csrf: false })).status, 403);
  assert.equal((await nav.chamar('/api/protegido/escrever', { metodo: 'POST' })).status, 201);

  const saude = await fetch(`${url}/health`);
  assert.equal(saude.status, 200);
  assert.deepEqual(await saude.json(), { service: 'api', status: 'ok' });
  assert.equal((await fetch(`${url}/api/health`)).status, 404);
  assert.equal((await fetch(`${url}/auth/sessao`)).status, 404);

  const logout = await nav.chamar('/api/auth/logout', { metodo: 'POST' });
  assert.equal(logout.status, 204);
  const limpeza = logout.headers.getSetCookie().find((l) => l.startsWith('prdal_refresh='));
  assert.match(limpeza, /Path=\/api\/auth\/refresh/);
});

test('com prefixo, login sem o prefixo nao fica isento de csrf', async (t) => {
  comPrefixo(t, '/api');
  const { url } = await subir(t);
  const r = await fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vitima@teste.dev', senha: SENHA }),
  });
  assert.equal(r.status, 403);
});

test('sem API_PREFIXO o health e as rotas ficam na raiz', async (t) => {
  const { url, navegador } = await subir(t);
  assert.equal((await fetch(`${url}/health`)).status, 200);
  const nav = navegador();
  assert.equal((await nav.entrar('vitima@teste.dev', SENHA)).status, 201);
  assert.equal(nav.jarra.get('prdal_refresh').attrs.path, '/auth/refresh');
});

function comVersao(t, valor) {
  if (valor === undefined) delete process.env.API_VERSAO;
  else process.env.API_VERSAO = valor;
  t.after(() => delete process.env.API_VERSAO);
}

test('versao entra no prefixo por padrao e se combina com API_PREFIXO', () => {
  const { prefixoApi, semPrefixo, versaoApi } = require('../dist/config/prefixo');
  assert.equal(versaoApi({}), 'v1');
  assert.equal(prefixoApi({}), '/v1');
  assert.equal(prefixoApi({ API_PREFIXO: '/api' }), '/api/v1');
  assert.equal(prefixoApi({ API_PREFIXO: '/api', API_VERSAO: '/v2/' }), '/api/v2');
  assert.equal(prefixoApi({ API_VERSAO: '' }), '');
  assert.equal(semPrefixo('/api/v1/auth/login', { API_PREFIXO: '/api' }), '/auth/login');
  assert.equal(semPrefixo('/api/auth/login', { API_PREFIXO: '/api' }), null);
});

test('rotas versionadas: login, refresh e csrf seguem /api/v1 e health e ready ficam na raiz', async (t) => {
  comPrefixo(t, '/api');
  const { url, navegador } = await subirComVersao(t);
  const nav = navegador();
  const login = await nav.chamar('/api/v1/auth/login', { metodo: 'POST', csrf: false, corpo: { email: 'vitima@teste.dev', senha: SENHA } });
  assert.equal(login.status, 201);
  assert.equal(nav.jarra.get('prdal_refresh').attrs.path, '/api/v1/auth/refresh');
  assert.equal((await nav.chamar('/api/v1/auth/refresh', { metodo: 'POST', csrf: false })).status, 200);
  assert.equal((await nav.chamar('/api/v1/protegido/escrever', { metodo: 'POST', csrf: false })).status, 403);
  assert.equal((await nav.chamar('/api/v1/protegido/escrever', { metodo: 'POST' })).status, 201);
  assert.equal((await nav.chamar('/api/protegido/ler')).status, 404);
  assert.equal((await fetch(`${url}/health`)).status, 200);
  assert.equal((await fetch(`${url}/api/v1/health`)).status, 404);
});

async function subirComVersao(t) {
  comVersao(t, undefined);
  const { subirAuth } = require('./helpers/auth-app');
  const usuarios = [{ id: 'vitima', email: 'vitima@teste.dev', senhaHash: await bcrypt.hash(SENHA, 4), criadoEm: new Date() }];
  process.env.API_VERSAO = 'v1';
  return subirAuth(t, { usuarios });
}
