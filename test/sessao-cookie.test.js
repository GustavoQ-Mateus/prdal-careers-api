const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { subirAuth } = require('./helpers/auth-app');

const SENHA = 'senha-forte-da-vitima';

async function contaVitima() {
  return [{ id: 'vitima', email: 'vitima@teste.dev', senhaHash: await bcrypt.hash(SENHA, 4), criadoEm: new Date() }];
}

async function entrar(t) {
  const ctx = await subirAuth(t, { usuarios: await contaVitima() });
  const nav = ctx.navegador();
  const login = await nav.entrar('vitima@teste.dev', SENHA);
  assert.equal(login.status, 201);
  return { ...ctx, nav, login };
}

test('login grava sessao em cookies HttpOnly e o token nunca aparece no corpo', async (t) => {
  const { nav, login } = await entrar(t);
  const corpo = await login.json();
  assert.deepEqual(Object.keys(corpo).sort(), ['csrfToken', 'usuario']);
  const acesso = nav.jarra.get('prdal_access');
  const refresh = nav.jarra.get('prdal_refresh');
  const csrf = nav.jarra.get('prdal_csrf');
  assert.ok(acesso.attrs.httponly && acesso.attrs.samesite === 'Lax' && acesso.attrs.path === '/');
  assert.equal(acesso.attrs['max-age'], '900');
  assert.ok(refresh.attrs.httponly && refresh.attrs.path === '/auth/refresh');
  assert.equal(csrf.attrs.httponly, undefined);
  assert.equal(csrf.valor, corpo.csrfToken);
  assert.equal(acesso.attrs.secure, undefined);
  assert.equal((await nav.chamar('/protegido/ler')).status, 200);
});

test('com PRDAL_HTTPS ligado os cookies saem com Secure', async (t) => {
  process.env.PRDAL_HTTPS = 'true';
  t.after(() => delete process.env.PRDAL_HTTPS);
  const { nav } = await entrar(t);
  for (const nome of ['prdal_access', 'prdal_refresh', 'prdal_csrf']) assert.equal(nav.jarra.get(nome).attrs.secure, true, nome);
});

test('o refresh nao e enviado fora de /auth/refresh e document.cookie so ve o csrf', async (t) => {
  const { nav } = await entrar(t);
  const visiveisAoScript = [...nav.jarra.entries()].filter(([, c]) => !c.attrs.httponly).map(([n]) => n);
  assert.deepEqual(visiveisAoScript, ['prdal_csrf']);
});

test('token de sessao valido no header Authorization nao e aceito', async (t) => {
  const { url, nav } = await entrar(t);
  const acesso = nav.jarra.get('prdal_access').valor;
  const r = await fetch(`${url}/protegido/ler`, { headers: { Authorization: `Bearer ${acesso}` } });
  assert.equal(r.status, 401);
});

test('escrita sem X-CSRF-Token ou com token errado retorna 403', async (t) => {
  const { nav } = await entrar(t);
  assert.equal((await nav.chamar('/protegido/escrever', { metodo: 'POST', csrf: false })).status, 403);
  const errado = await nav.chamar('/protegido/escrever', { metodo: 'POST', csrf: false, cabecalhos: { 'X-CSRF-Token': 'outro-valor' } });
  assert.equal(errado.status, 403);
  assert.deepEqual(await errado.json(), { erro: { codigo: 'csrf_invalido', mensagem: 'token csrf ausente ou invalido', requestId: null } });
  for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
    assert.equal((await nav.chamar('/protegido/escrever', { metodo, csrf: false })).status, 403, metodo);
  }
  assert.equal((await nav.chamar('/protegido/escrever', { metodo: 'POST' })).status, 201);
});

test('refresh gira o token e o reuso de um refresh ja trocado revoga a familia', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const { nav, prisma } = await entrar(t);
  const ladrao = nav.clonar();
  const primeiro = await nav.chamar('/auth/refresh', { metodo: 'POST' });
  assert.equal(primeiro.status, 200);
  assert.notEqual(nav.jarra.get('prdal_refresh').valor, ladrao.jarra.get('prdal_refresh').valor);
  assert.equal((await nav.chamar('/protegido/ler')).status, 200);

  t.mock.timers.tick(31_000);
  const reuso = await ladrao.chamar('/auth/refresh', { metodo: 'POST' });
  assert.equal(reuso.status, 401);
  assert.ok(prisma.sessoes.every((s) => s.revogadaEm), 'toda a familia revogada');
  assert.equal((await nav.chamar('/auth/refresh', { metodo: 'POST' })).status, 401);
  assert.equal((await nav.chamar('/protegido/ler')).status, 401);
  assert.ok(prisma.sessoes.every((s) => /^[0-9a-f]{64}$/.test(s.refreshHash)), 'refresh guardado como hash');
});

test('dois refresh simultaneos com o mesmo cookie dao 200 e 409 sem revogar a familia', async (t) => {
  const { nav, prisma } = await entrar(t);
  const outraAba = nav.clonar();
  const respostas = await Promise.all([
    nav.chamar('/auth/refresh', { metodo: 'POST' }),
    outraAba.chamar('/auth/refresh', { metodo: 'POST' }),
  ]);
  assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409]);
  const conflito = respostas.find((r) => r.status === 409);
  assert.deepEqual(conflito.headers.getSetCookie(), []);
  assert.equal((await conflito.json()).message, 'sessao renovada em outra aba');
  assert.ok(prisma.sessoes.every((s) => !s.revogadaEm), 'nenhuma sessao revogada');

  const vencedora = respostas[0].status === 200 ? nav : outraAba;
  assert.equal((await vencedora.chamar('/protegido/ler')).status, 200);
  assert.equal((await vencedora.chamar('/auth/refresh', { metodo: 'POST' })).status, 200);
  assert.equal((await vencedora.chamar('/protegido/ler')).status, 200);
});

test('reuso dentro da janela de tolerancia da 409 e depois dela revoga a familia', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const { nav, prisma } = await entrar(t);
  const perdida = nav.clonar();
  assert.equal((await nav.chamar('/auth/refresh', { metodo: 'POST' })).status, 200);

  t.mock.timers.tick(29_000);
  assert.equal((await perdida.chamar('/auth/refresh', { metodo: 'POST' })).status, 409);
  assert.ok(prisma.sessoes.every((s) => !s.revogadaEm));
  assert.equal((await nav.chamar('/protegido/ler')).status, 200);

  t.mock.timers.tick(2_000);
  assert.equal((await perdida.chamar('/auth/refresh', { metodo: 'POST' })).status, 401);
  assert.ok(prisma.sessoes.every((s) => s.revogadaEm), 'toda a familia revogada');
  assert.equal((await nav.chamar('/protegido/ler')).status, 401);
});

test('REFRESH_TOLERANCIA_S=0 desliga a janela e o reuso imediato ja revoga', async (t) => {
  process.env.REFRESH_TOLERANCIA_S = '0';
  t.after(() => delete process.env.REFRESH_TOLERANCIA_S);
  const { nav, prisma } = await entrar(t);
  const perdida = nav.clonar();
  assert.equal((await nav.chamar('/auth/refresh', { metodo: 'POST' })).status, 200);
  assert.equal((await perdida.chamar('/auth/refresh', { metodo: 'POST' })).status, 401);
  assert.ok(prisma.sessoes.every((s) => s.revogadaEm));
});

test('logout revoga a sessao: refresh e acesso deixam de valer', async (t) => {
  const { nav } = await entrar(t);
  const copia = nav.clonar();
  assert.equal((await nav.chamar('/auth/logout', { metodo: 'POST' })).status, 204);
  assert.equal(nav.jarra.size, 0);
  assert.equal((await copia.chamar('/auth/refresh', { metodo: 'POST' })).status, 401);
  assert.equal((await copia.chamar('/protegido/ler')).status, 401);
});

test('troca de senha derruba as outras sessoes e mantem a atual com sessao nova', async (t) => {
  const ctx = await subirAuth(t, { usuarios: await contaVitima() });
  const notebook = ctx.navegador();
  const celular = ctx.navegador();
  await notebook.entrar('vitima@teste.dev', SENHA);
  await celular.entrar('vitima@teste.dev', SENHA);

  const errada = await notebook.chamar('/auth/senha', { metodo: 'POST', corpo: { senhaAtual: 'nao-e-essa', novaSenha: 'nova-senha-123456' } });
  assert.equal(errada.status, 401);
  const curta = await notebook.chamar('/auth/senha', { metodo: 'POST', corpo: { senhaAtual: SENHA, novaSenha: 'curta' } });
  assert.equal(curta.status, 400);

  const troca = await notebook.chamar('/auth/senha', { metodo: 'POST', corpo: { senhaAtual: SENHA, novaSenha: 'nova-senha-123456' } });
  assert.equal(troca.status, 204);
  assert.equal((await celular.chamar('/protegido/ler')).status, 401);
  assert.equal((await celular.chamar('/auth/refresh', { metodo: 'POST' })).status, 401);
  assert.equal((await notebook.chamar('/protegido/ler')).status, 200);
  assert.equal((await notebook.chamar('/auth/refresh', { metodo: 'POST' })).status, 200);

  const antiga = ctx.navegador();
  assert.equal((await antiga.entrar('vitima@teste.dev', SENHA)).status, 401);
  assert.equal((await antiga.entrar('vitima@teste.dev', 'nova-senha-123456')).status, 201);
});

test('sessao devolve o csrf para o web e login, cadastro e refresh dispensam o header', async (t) => {
  const { nav } = await entrar(t);
  const sessao = await nav.chamar('/auth/sessao');
  assert.equal(sessao.status, 200);
  const corpo = await sessao.json();
  assert.equal(corpo.csrfToken, nav.jarra.get('prdal_csrf').valor);
  assert.equal(corpo.usuario.email, 'vitima@teste.dev');
  assert.equal((await nav.chamar('/auth/refresh', { metodo: 'POST', csrf: false })).status, 200);
});
