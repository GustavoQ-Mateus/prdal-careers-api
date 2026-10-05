require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { ThrottlerModule } = require('@nestjs/throttler');
const { ValidationPipe } = require('@nestjs/common');
const { turnoTexto, turnosEmMemoria } = require('./helpers/turnos');
const { subirApp, autenticado } = require('./helpers/app-teste');

const PG = process.env.PRDAL_TESTE_POSTGRES_URL;
const SEM_PG = !PG && 'defina PRDAL_TESTE_POSTGRES_URL com um banco descartavel';

function comAmbiente(t, valores) {
  const anterior = Object.fromEntries(Object.keys(valores).map((k) => [k, process.env[k]]));
  Object.assign(process.env, valores);
  t.after(() => {
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

function conversasFalsas() {
  const conversas = new Map();
  return {
    abrir: async (usuarioId, conversaId, modo) => {
      const id = conversaId ?? 'nova';
      if (!conversas.has(id)) conversas.set(id, { _id: id, usuarioId, modo, oportunidadeId: null, mensagens: [], pendencia: null });
      return conversas.get(id);
    },
    anexar: async (id, mensagem) => conversas.get(id).mensagens.push(mensagem),
    definirPendencia: async () => {},
    definirResumo: async () => {},
  };
}

function respostaFalsa() {
  const escritas = [];
  return {
    escritas,
    destroyed: false,
    writableEnded: false,
    setHeader() {},
    flushHeaders() {},
    on() {},
    write(bloco) {
      escritas.push(bloco);
    },
    end() {
      this.writableEnded = true;
    },
  };
}

test('heartbeat a cada intervalo enquanto o turno corre e para no fim', async (t) => {
  comAmbiente(t, { SSE_HEARTBEAT_MS: '25' });
  const { ChatService } = require('../dist/copiloto/chat.service');
  const ai = { copilotoTurnStream: () => new Promise((r) => setTimeout(() => r(turnoTexto('pronto')), 140)) };
  const res = respostaFalsa();
  await new ChatService(conversasFalsas(), ai, {}, { garantirVaga: async () => {} }).chat(res, { userId: 'u1' }, { mensagem: 'oi' });
  assert.equal(res.escritas[0], 'event: conversa\ndata: {"conversaId":"nova"}\n\n');
  const batimentos = res.escritas.filter((e) => e === ': heartbeat\n\n');
  assert.ok(batimentos.length >= 3, `batimentos: ${batimentos.length}`);
  assert.match(res.escritas.at(-1), /^event: fim_turno\n/);
  const total = res.escritas.length;
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(res.escritas.length, total);
});

test('intervalo padrao do heartbeat e 15 s', () => {
  const { intervaloHeartbeatMs } = require('../dist/copiloto/turnos.service');
  assert.equal(intervaloHeartbeatMs({}), 15000);
  assert.equal(intervaloHeartbeatMs({ SSE_HEARTBEAT_MS: 'abc' }), 15000);
});

async function replica(t, turnos, ai) {
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { TurnosService } = require('../dist/copiloto/turnos.service');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const conversas = conversasFalsas();
  const chat = new ChatService(conversas, ai, {}, { garantirVaga: async () => {} });
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [CopilotoController],
    providers: [
      { provide: ChatService, useValue: chat },
      { provide: CapacidadesService, useValue: {} },
      { provide: ConversasService, useValue: conversas },
      { provide: TurnosService, useValue: turnos },
      { provide: require('../dist/cota/cota-tokens.service').CotaTokensService, useValue: { verificar: async () => {} } },
    ],
    configurar: (app) => app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })),
  });
  return (corpo) =>
    fetch(`${url}/copiloto/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...autenticado('u1') },
      body: JSON.stringify(corpo),
    });
}

function aiControlada() {
  let liberar;
  const portao = new Promise((r) => {
    liberar = r;
  });
  let chamadas = 0;
  return {
    liberar: () => liberar(),
    get chamadas() {
      return chamadas;
    },
    copilotoTurnStream: async () => {
      chamadas++;
      if (chamadas === 1) await portao;
      return turnoTexto('feito');
    },
  };
}

async function provarUmTurnoPorConversa(t, turnosA, turnosB) {
  const ai = aiControlada();
  const enviarA = await replica(t, turnosA, ai);
  const enviarB = await replica(t, turnosB, ai);
  const primeiro = await enviarA({ mensagem: 'primeira', conversaId: 'conversa-1' });
  assert.equal(primeiro.status, 201);
  const leitor = primeiro.body.getReader();
  await leitor.read();

  const segundo = await enviarB({ mensagem: 'segunda', conversaId: 'conversa-1' });
  assert.equal(segundo.status, 409);
  assert.match(JSON.stringify(await segundo.json()), /em andamento nesta conversa/);
  assert.equal(ai.chamadas, 1);

  const outraConversa = await enviarB({ mensagem: 'outra', conversaId: 'conversa-2' });
  assert.equal(outraConversa.status, 201);
  await outraConversa.text();

  ai.liberar();
  while (!(await leitor.read()).done);
  const depois = await enviarB({ mensagem: 'terceira', conversaId: 'conversa-1' });
  assert.equal(depois.status, 201);
  assert.match(await depois.text(), /event: fim_turno/);
}

test('um turno por conversa: segundo pedido na outra replica recebe 409 ate o primeiro terminar', async (t) => {
  const travas = new Map();
  await provarUmTurnoPorConversa(t, turnosEmMemoria(travas), turnosEmMemoria(travas));
});

function prismaDoBanco(t) {
  const raiz = path.resolve(__dirname, '..');
  const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: raiz, env: { ...process.env, DATABASE_URL: PG }, encoding: 'utf8', shell: true });
  assert.equal(deploy.status, 0, deploy.stderr + deploy.stdout);
  const { PrismaClient } = require('@prisma/client');
  const cliente = new PrismaClient({ datasourceUrl: PG });
  t.after(() => cliente.$disconnect());
  return cliente;
}

test('trava no banco: duas replicas com conexoes proprias, so uma pega o turno', { skip: SEM_PG }, async (t) => {
  const { TurnosService } = require('../dist/copiloto/turnos.service');
  const replicaA = new TurnosService(prismaDoBanco(t));
  const replicaB = new TurnosService(prismaDoBanco(t));
  await replicaA.prisma.$executeRawUnsafe('DELETE FROM turnos_copiloto');

  const tentativas = await Promise.all(
    Array.from({ length: 10 }, (_, i) => (i % 2 ? replicaA : replicaB).adquirir('conversa-pg')),
  );
  const vencedores = tentativas.filter(Boolean);
  assert.equal(vencedores.length, 1);
  await assert.rejects(replicaB.exigir('conversa-pg'), { status: 409 });
  await replicaA.liberar(vencedores[0]);
  const novo = await replicaB.adquirir('conversa-pg');
  assert.ok(novo);
  await replicaB.liberar(novo);

  await provarUmTurnoPorConversa(t, replicaA, replicaB);
});

test('lease expirado e retomado por outra replica e renovacao segura o turno', { skip: SEM_PG }, async (t) => {
  comAmbiente(t, { TURNO_LEASE_S: '1' });
  const { TurnosService } = require('../dist/copiloto/turnos.service');
  const replicaA = new TurnosService(prismaDoBanco(t));
  const replicaB = new TurnosService(prismaDoBanco(t));
  await replicaA.prisma.$executeRawUnsafe('DELETE FROM turnos_copiloto');
  const turno = await replicaA.adquirir('conversa-lease');
  assert.ok(turno);
  await new Promise((r) => setTimeout(r, 700));
  await replicaA.renovar(turno);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(await replicaB.adquirir('conversa-lease'), null);
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(await replicaB.adquirir('conversa-lease'));
});

test('keepAliveTimeout acima do idle do ALB e headersTimeout acima dele', () => {
  const { temposServidor, configurarServidor } = require('../dist/config/servidor');
  assert.deepEqual(temposServidor({}), { keepAliveTimeout: 65000, headersTimeout: 66000 });
  assert.deepEqual(temposServidor({ BALANCEADOR_IDLE_S: '120' }), { keepAliveTimeout: 125000, headersTimeout: 126000 });
  assert.deepEqual(temposServidor({ HTTP_KEEPALIVE_TIMEOUT_MS: '70000', HTTP_HEADERS_TIMEOUT_MS: '75000' }), { keepAliveTimeout: 70000, headersTimeout: 75000 });
  assert.throws(() => temposServidor({ HTTP_KEEPALIVE_TIMEOUT_MS: '60000' }), /maior que o idle do balanceador/);
  assert.throws(() => temposServidor({ HTTP_KEEPALIVE_TIMEOUT_MS: '70000', HTTP_HEADERS_TIMEOUT_MS: '70000' }), /maior que HTTP_KEEPALIVE_TIMEOUT_MS/);
  const servidor = http.createServer();
  configurarServidor(servidor, {});
  assert.equal(servidor.keepAliveTimeout, 65000);
  assert.equal(servidor.headersTimeout, 66000);
});
