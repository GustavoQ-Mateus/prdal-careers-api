require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { NestFactory } = require('@nestjs/core');

function servidorQueRegistra() {
  const recebidas = [];
  const servidor = http.createServer((req, res) => {
    recebidas.push({ url: req.url, prazo: req.headers['x-prdal-prazo-ms'], operacao: req.headers['x-prdal-operacao'] });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/copiloto/turn/stream') {
      res.end(`${JSON.stringify({ tipo: 'fim', conteudo: [{ type: 'text', text: 'oi' }], parada: 'end_turn' })}\n`);
      return;
    }
    const corpos = {
      '/keywords': { keywords: [{ termo: 'Python', peso: 1 }], status: 'VALIDAS', degradacao: null },
      '/copiloto/redigir-formulario': { titulo: 'Formulario', respostas: [] },
    };
    res.end(JSON.stringify(corpos[req.url] ?? { chunks: [] }));
  });
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => resolve({ servidor, recebidas, url: `http://127.0.0.1:${servidor.address().port}` }));
  });
}

test('chamadas de LLM enviam ao ai-service o prazo restante e a operacao, as demais nao', async (t) => {
  const { servidor, recebidas, url } = await servidorQueRegistra();
  t.after(() => servidor.close());
  process.env.AI_SERVICE_URL = url;
  process.env.AI_LLM_TIMEOUT_MS = '45000';

  const { ClientsModule } = require('../dist/clients/clients.module');
  const { AiClient } = require('../dist/clients/ai.client');
  const app = await NestFactory.createApplicationContext(ClientsModule, { logger: false });
  t.after(() => app.close());
  const ai = app.get(AiClient);

  await ai.keywords('Vaga Python');
  await ai.copilotoTurnStream({ modo: 'assistido', oportunidadeId: null, trocas: [], resumo: null, tools: [] }, { operacao: 'conversa:c1' }, () => {});
  await ai.redigirFormulario({ vaga: {}, perfil: {}, campos: [] }, { operacao: 'formulario:f1' });
  await ai.embeddingConsultas(['consulta']);

  assert.deepEqual(recebidas, [
    { url: '/keywords', prazo: '44000', operacao: undefined },
    { url: '/copiloto/turn/stream', prazo: '44000', operacao: 'conversa:c1' },
    { url: '/copiloto/redigir-formulario', prazo: '44000', operacao: 'formulario:f1' },
    { url: '/embeddings/consultas', prazo: undefined, operacao: undefined },
  ]);
});
