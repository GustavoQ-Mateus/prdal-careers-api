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

async function cabecalhos(t) {
  const { configurarCabecalhos } = require('../dist/config/cabecalhos');
  const { url } = await subirApp(t, { controllers: [Saude], configurar: configurarCabecalhos });
  return (await fetch(`${url}/saude`)).headers;
}

test('api nao expoe X-Powered-By e envia cabecalhos de seguranca', async (t) => {
  delete process.env.PRDAL_HSTS;
  const h = await cabecalhos(t);
  assert.equal(h.get('x-powered-by'), null);
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.equal(h.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(h.get('content-security-policy'), /default-src 'none'/);
  assert.match(h.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(h.get('referrer-policy'), 'no-referrer');
  assert.equal(h.get('strict-transport-security'), null);
});

test('HSTS so quando PRDAL_HSTS esta definido', async (t) => {
  process.env.PRDAL_HSTS = 'max-age=31536000; includeSubDomains';
  t.after(() => delete process.env.PRDAL_HSTS);
  const h = await cabecalhos(t);
  assert.equal(h.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
});
