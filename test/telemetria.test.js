require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, autenticado } = require('./helpers/app-teste');
const { TelemetriaModule } = require('../dist/telemetria/telemetria.module');
const { ACOES_RAPIDAS } = require('../dist/telemetria/telemetria.dto');
const { JANELAS } = require('../dist/limites/limite-requisicoes');
const { configurarCsrf } = require('../dist/config/csrf');
const { configurarPrefixo } = require('../dist/config/prefixo');

async function subirTelemetria(t, configurar) {
  return subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS), TelemetriaModule],
    configurar: (app) => {
      configurarPrefixo(app, {});
      configurarCsrf(app);
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      configurar?.(app);
    },
  });
}

function enviar(url, corpo, headers = autenticado('usuario-telemetria')) {
  return fetch(`${url}/v1/telemetria/eventos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(corpo),
  });
}

test('telemetria exige autenticacao e csrf', async (t) => {
  const { url } = await subirTelemetria(t);
  const corpo = { evento: 'copiloto_primeira_mensagem', sessaoId: 'aba-123' };
  assert.equal((await enviar(url, corpo, { Cookie: 'prdal_csrf=teste', 'X-CSRF-Token': 'teste' })).status, 401);
  assert.equal((await enviar(url, corpo, { Cookie: autenticado('usuario').Cookie })).status, 403);
});

test('primeira mensagem e todas as acoes atuais respondem 204 sem corpo', async (t) => {
  const { url } = await subirTelemetria(t);
  const corpos = [
    { evento: 'copiloto_primeira_mensagem', sessaoId: 'a'.repeat(64) },
    ...ACOES_RAPIDAS.map((acao) => ({ evento: 'copiloto_acao_rapida', sessaoId: 'aba_123-ABC', acao })),
  ];
  for (const corpo of corpos) {
    const resposta = await enviar(url, corpo);
    assert.equal(resposta.status, 204, JSON.stringify(corpo));
    assert.equal(await resposta.text(), '');
  }
});

test('telemetria recusa evento, acao e identificador invalidos', async (t) => {
  const { url } = await subirTelemetria(t);
  const base = { evento: 'copiloto_primeira_mensagem', sessaoId: 'aba-123' };
  const invalidos = [
    {},
    ...['desconhecido', '', null, 1, ['copiloto_primeira_mensagem']].map((evento) => ({ ...base, evento })),
    { ...base, evento: 'copiloto_acao_rapida' },
    ...['desconhecida', '', null, 1, ['preparar_envio']].flatMap((acao) => [
      { ...base, acao },
      { ...base, evento: 'copiloto_acao_rapida', acao },
    ]),
    ...[undefined, '', null, 123, {}, 'a'.repeat(65), 'com espaco', 'linha\nnova', 'email@teste.dev', 'á', '../aba'].map((sessaoId) => ({ ...base, sessaoId })),
  ];
  for (const corpo of invalidos) {
    const resposta = await enviar(url, corpo, autenticado(`invalido-${invalidos.indexOf(corpo)}`));
    assert.equal(resposta.status, 400, JSON.stringify(corpo));
  }
});
