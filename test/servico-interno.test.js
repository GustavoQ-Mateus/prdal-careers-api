require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { NestFactory } = require('@nestjs/core');

const TOKEN = 'token-de-servico-de-teste-com-mais-de-32-bytes';

function servidorQueRegistra() {
  const recebidas = [];
  const servidor = http.createServer((req, res) => {
    recebidas.push({ url: req.url, servico: req.headers['x-prdal-servico'] });
    res.setHeader('Content-Type', 'application/json');
    res.end(req.url.startsWith('/render/') ? '{}' : JSON.stringify({ chunks: [] }));
  });
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => resolve({ servidor, recebidas, url: `http://127.0.0.1:${servidor.address().port}` }));
  });
}

test('clientes internos enviam o token de servico ao ai-service e ao doc-service', async (t) => {
  const { servidor, recebidas, url } = await servidorQueRegistra();
  t.after(() => servidor.close());
  process.env.AI_SERVICE_URL = url;
  process.env.DOC_SERVICE_URL = url;
  process.env.SERVICE_TOKEN = TOKEN;
  t.after(() => delete process.env.SERVICE_TOKEN);

  const { ClientsModule } = require('../dist/clients/clients.module');
  const { AiClient } = require('../dist/clients/ai.client');
  const { DocClient } = require('../dist/clients/doc.client');
  const app = await NestFactory.createApplicationContext(ClientsModule, { logger: false });
  t.after(() => app.close());

  await app.get(AiClient).embeddingConsultas(['consulta']);
  await app.get(AiClient).filtrarTrechos([{ consulta: 'SQL', trechos: [{ id: 'n1', texto: 'SQL' }] }]);
  await app.get(DocClient).renderPdf('# Nome');

  assert.deepEqual(recebidas, [
    { url: '/embeddings/consultas', servico: TOKEN },
    { url: '/rag/filtrar', servico: TOKEN },
    { url: '/render/pdf', servico: TOKEN },
  ]);
});
