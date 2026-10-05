const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const { subirApp } = require('./helpers/app-teste');

function servidor(t, rotas) {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const rota = rotas[req.url];
      if (!rota) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(rota.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(rota.corpo ?? {}));
    });
    srv.listen(0, '127.0.0.1', () => {
      t.after(() => srv.close());
      resolver(`http://127.0.0.1:${srv.address().port}`);
    });
  });
}

function portaFechada() {
  return new Promise((resolver) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${srv.address().port}`;
      srv.close(() => resolver(url));
    });
  });
}

const AI_PRONTO = {
  status: 200,
  corpo: { servico: 'ai-service', status: 'pronto', dependencias: [{ nome: 'embeddings', obrigatoria: false, estado: 'ok' }] },
};

async function subir(t, { ai, doc, prisma, prefixo, fila } = {}) {
  const { Fila } = require('../dist/jobs/fila');
  const { SaudeController } = require('../dist/saude/saude.controller');
  const { SaudeService } = require('../dist/saude/saude.service');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { configurarPrefixo } = require('../dist/config/prefixo');
  const env = {
    AI_SERVICE_URL: ai ?? (await servidor(t, { '/ready': AI_PRONTO })),
    DOC_SERVICE_URL: doc ?? (await servidor(t, { '/health': { status: 200 } })),
    PRONTIDAO_TIMEOUT_MS: '300',
    API_PREFIXO: prefixo ?? '',
  };
  const anterior = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const { LoggerJson } = require('../dist/observabilidade/logger');
  const { configurarContexto, configurarRequisicoes } = require('../dist/observabilidade/requisicao');
  logs.length = 0;
  const logger = new LoggerJson('api', (linha) => logs.push(JSON.parse(linha)));
  return subirApp(t, {
    controllers: [SaudeController],
    providers: [
      SaudeService,
      { provide: PrismaService, useValue: prisma ?? { $queryRaw: async () => [{ '?column?': 1 }] } },
      { provide: Fila, useValue: fila ?? { verificar: async () => {} } },
    ],
    configurar: (app) => {
      app.useLogger(logger);
      configurarRequisicoes(app, logger);
      configurarContexto(app);
      configurarPrefixo(app);
    },
  });
}

const logs = [];

function motivoNoLog(dependencia) {
  return logs.find((l) => l.mensagem === 'dependencia fora' && l.dependencia === dependencia);
}

async function ready(url, caminho = '/ready') {
  const resposta = await fetch(`${url}${caminho}`);
  const corpo = await resposta.json();
  for (const d of corpo.dependencias) assert.deepEqual(Object.keys(d), ['nome', 'obrigatoria', 'estado'], d.nome);
  return { status: resposta.status, requestId: resposta.headers.get('x-request-id'), corpo, deps: Object.fromEntries(corpo.dependencias.map((d) => [d.nome, d])) };
}

test('tudo no ar: ready 200 com cada dependencia e se e obrigatoria', async (t) => {
  const { url } = await subir(t);
  const { status, corpo, deps } = await ready(url);
  assert.equal(status, 200);
  assert.equal(corpo.status, 'pronto');
  assert.deepEqual(Object.keys(deps), ['postgres', 'ai-service', 'embeddings', 'doc-service', 'fila']);
  for (const d of Object.values(deps)) assert.equal(d.estado, 'ok', d.nome);
  assert.equal(deps.postgres.obrigatoria, true);
  assert.equal(deps['ai-service'].obrigatoria, false);
  assert.equal(deps['doc-service'].obrigatoria, false);
  assert.equal(deps.embeddings.obrigatoria, false);
  assert.equal(deps.fila.obrigatoria, false);
});

test('fila fora nao derruba o ready da api: o job fica pendente para a varredura do worker', async (t) => {
  const { url } = await subir(t, { fila: { verificar: async () => { throw new Error('fila fora'); } } });
  const { status, deps } = await ready(url);
  assert.equal(status, 200);
  assert.equal(deps.fila.estado, 'indisponivel');
  assert.match(motivoNoLog('fila').detalhe, /fila fora/);
});

test('ai-service fora: api segue pronta e aponta ai-service e embeddings', async (t) => {
  const { url } = await subir(t, { ai: await portaFechada() });
  const { status, deps, requestId } = await ready(url);
  assert.equal(status, 200);
  assert.equal(deps['ai-service'].estado, 'indisponivel');
  assert.equal(deps.embeddings.estado, 'desconhecido');
  const motivo = motivoNoLog('ai-service');
  assert.match(motivo.detalhe, /fetch failed|ECONNREFUSED|aborted/);
  assert.equal(motivo.requestId, requestId);
  assert.equal(motivo.nivel, 'warn');
  assert.equal(deps['doc-service'].estado, 'ok');
});

test('doc-service fora: api segue pronta e aponta o doc-service', async (t) => {
  const { url } = await subir(t, { doc: await portaFechada() });
  const { status, deps } = await ready(url);
  assert.equal(status, 200);
  assert.equal(deps['doc-service'].estado, 'indisponivel');
  assert.equal(deps['ai-service'].estado, 'ok');
});

test('embeddings fora: vem do ready do ai-service e a api segue pronta', async (t) => {
  const ai = await servidor(t, {
    '/ready': { status: 200, corpo: { dependencias: [{ nome: 'embeddings', obrigatoria: false, estado: 'indisponivel', detalhe: 'modelo nao carregado' }] } },
  });
  const { url } = await subir(t, { ai });
  const { status, deps } = await ready(url);
  assert.equal(status, 200);
  assert.equal(deps.embeddings.estado, 'indisponivel');
  assert.equal(motivoNoLog('embeddings').estado, 'indisponivel');
  assert.equal(deps['ai-service'].estado, 'ok');
});

test('ai-service respondendo 503 conta como indisponivel', async (t) => {
  const ai = await servidor(t, { '/ready': { status: 503, corpo: { dependencias: [] } } });
  const { url } = await subir(t, { ai });
  const { status, deps } = await ready(url);
  assert.equal(status, 200);
  assert.equal(deps['ai-service'].estado, 'indisponivel');
  assert.match(motivoNoLog('ai-service').detalhe, /503/);
});

test('postgres fora: ready 503', async (t) => {
  const { url } = await subir(t, { prisma: { $queryRaw: async () => { throw new Error('conexao recusada'); } } });
  const { status, corpo, deps } = await ready(url);
  assert.equal(status, 503);
  assert.equal(corpo.status, 'indisponivel');
  assert.equal(deps.postgres.estado, 'indisponivel');
});

test('postgres sem resposta: ready 503 dentro do prazo e postgres e a unica obrigatoria', async (t) => {
  const { url } = await subir(t, { prisma: { $queryRaw: () => new Promise(() => {}) } });
  const inicio = Date.now();
  const { status, deps } = await ready(url);
  assert.equal(status, 503);
  assert.equal(deps.postgres.estado, 'indisponivel');
  assert.deepEqual(Object.values(deps).filter((d) => d.obrigatoria).map((d) => d.nome), ['postgres']);
  assert.match(motivoNoLog('postgres').detalhe, /sem resposta/);
  assert.ok(Date.now() - inicio < 2000);
});

test('health e ready ficam fora do API_PREFIXO', async (t) => {
  const { url } = await subir(t, { prefixo: '/api' });
  assert.equal((await fetch(`${url}/health`)).status, 200);
  assert.equal((await ready(url)).status, 200);
  assert.equal((await fetch(`${url}/api/ready`)).status, 404);
});
