require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { Controller, Get } = require('@nestjs/common');
const { subirApp } = require('./helpers/app-teste');

class Saude {
  ler() {
    return { ok: true };
  }
}
Get('saude')(Saude.prototype, 'ler', Object.getOwnPropertyDescriptor(Saude.prototype, 'ler'));
Controller()(Saude);

test('origens vem de CORS_ORIGINS, sem curinga, e em producao sem lista nada e liberado', () => {
  const { origensPermitidas } = require('../dist/config/cors');
  assert.deepEqual(origensPermitidas({ CORS_ORIGINS: 'https://app.prdal.dev/, http://localhost:5173 ,*' }), [
    'https://app.prdal.dev',
    'http://localhost:5173',
  ]);
  assert.deepEqual(origensPermitidas({}), []);
  assert.deepEqual(origensPermitidas({ CORS_ORIGINS: '*' }), []);
  assert.ok(origensPermitidas({ NODE_ENV: 'development' }).includes('http://localhost:5173'));
});

test('preflight so libera a origem da allowlist e com credenciais', async (t) => {
  const { opcoesCors } = require('../dist/config/cors');
  const { url } = await subirApp(t, {
    controllers: [Saude],
    configurar: (app) => app.enableCors(opcoesCors({ CORS_ORIGINS: 'http://localhost:5173' })),
  });
  const preflight = (origem) =>
    fetch(`${url}/saude`, {
      method: 'OPTIONS',
      headers: { Origin: origem, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-csrf-token,content-type' },
    });

  const permitida = await preflight('http://localhost:5173');
  assert.equal(permitida.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(permitida.headers.get('access-control-allow-credentials'), 'true');

  const evil = await preflight('https://evil.example');
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const simples = await fetch(`${url}/saude`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(simples.headers.get('access-control-allow-origin'), null);
});
