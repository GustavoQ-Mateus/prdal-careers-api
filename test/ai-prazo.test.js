require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { NestFactory } = require('@nestjs/core');

function servidorQueRegistra() {
  const recebidas = [];
  const servidor = http.createServer((req, res) => {
    recebidas.push({ url: req.url, prazo: req.headers['x-prdal-prazo-ms'] });
    res.setHeader('Content-Type', 'application/json');
    const corpos = {
      '/keywords': { keywords: [{ termo: 'Python', peso: 1 }], status: 'VALIDAS', degradacao: null },
      '/copiloto/turn': { tipo: 'texto', texto: 'oi', tool: null, args: {} },
      '/generate-cv-pipeline': { markdown: '# x', analiseInicial: {}, analiseFinal: {}, degradacao: null },
    };
    res.end(JSON.stringify(corpos[req.url] ?? { chunks: [] }));
  });
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => resolve({ servidor, recebidas, url: `http://127.0.0.1:${servidor.address().port}` }));
  });
}

test('chamadas de LLM enviam ao ai-service o prazo restante e as demais nao', async (t) => {
  const { servidor, recebidas, url } = await servidorQueRegistra();
  t.after(() => servidor.close());
  process.env.AI_SERVICE_URL = url;
  process.env.AI_LLM_TIMEOUT_MS = '45000';
  process.env.AI_GENERATE_TIMEOUT_MS = '200000';

  const { ClientsModule } = require('../dist/clients/clients.module');
  const { AiClient } = require('../dist/clients/ai.client');
  const app = await NestFactory.createApplicationContext(ClientsModule, { logger: false });
  t.after(() => app.close());
  const ai = app.get(AiClient);

  await ai.keywords('Vaga Python');
  await ai.copilotoTurn({ modo: 'assistido', oportunidadeId: null, mensagens: [], tools: [] });
  await ai.generateCvPipeline({ perfilMestre: {}, vaga: {}, keywords: [], contexto: [] });
  await ai.contextQuery('usuario-1', 'consulta');

  assert.deepEqual(recebidas, [
    { url: '/keywords', prazo: '44000' },
    { url: '/copiloto/turn', prazo: '44000' },
    { url: '/generate-cv-pipeline', prazo: '199000' },
    { url: '/context/query', prazo: undefined },
  ]);
});
