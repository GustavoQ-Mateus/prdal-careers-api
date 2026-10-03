require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, autenticado } = require('./helpers/app-teste');

async function subirAuth(t) {
  const { AuthController } = require('../dist/auth/auth.controller');
  const { AuthService } = require('../dist/auth/auth.service');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const tentativas = [];
  const auth = {
    login: async (dto) => {
      tentativas.push(dto.email);
      const { UnauthorizedException } = require('@nestjs/common');
      throw new UnauthorizedException('credenciais invalidas');
    },
    register: async () => ({ accessToken: 'x' }),
  };
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: auth }],
    configurar: (app) => app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })),
  });
  return { url, tentativas };
}

const login = (url, senha) =>
  fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vitima@teste.dev', senha }),
  });

test('40 logins errados seguidos recebem 429 com Retry-After a partir do limite', async (t) => {
  const { url, tentativas } = await subirAuth(t);
  const respostas = [];
  for (let i = 0; i < 40; i++) respostas.push(await login(url, `senha-errada-${i}`));
  const status = respostas.map((r) => r.status);

  assert.deepEqual(status.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.ok(status.slice(5).every((s) => s === 429), status.join(','));
  const bloqueada = respostas[5];
  const segundos = Number(bloqueada.headers.get('retry-after'));
  assert.ok(segundos > 0 && segundos <= 60, `Retry-After=${segundos}`);
  const corpo = await bloqueada.json();
  assert.equal(corpo.statusCode, 429);
  assert.match(corpo.message, /tente novamente/);
  assert.equal(tentativas.length, 5);
});

test('cadastro tambem e limitado por IP', async (t) => {
  const { url } = await subirAuth(t);
  const status = [];
  for (let i = 0; i < 7; i++) {
    const r = await fetch(`${url}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `pessoa${i}@teste.dev`, senha: 'senha-longa-123' }),
    });
    status.push(r.status);
  }
  assert.deepEqual(status, [201, 201, 201, 201, 201, 429, 429]);
});

test('chat e limitado por usuario, nao por IP', async (t) => {
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { JANELAS, LIMITES } = require('../dist/limites/limite-requisicoes');
  const chat = { chat: async (res) => res.status(200).json({ ok: true }) };
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [CopilotoController],
    providers: [
      { provide: ChatService, useValue: chat },
      { provide: CapacidadesService, useValue: {} },
      { provide: ConversasService, useValue: {} },
    ],
  });
  const enviar = (usuario) =>
    fetch(`${url}/copiloto/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...autenticado(usuario) },
      body: JSON.stringify({ mensagem: 'oi' }),
    });

  for (let i = 0; i < LIMITES.chat.minuto; i++) assert.equal((await enviar('usuario-a')).status, 200);
  const bloqueada = await enviar('usuario-a');
  assert.equal(bloqueada.status, 429);
  assert.ok(Number(bloqueada.headers.get('retry-after')) > 0);
  assert.equal((await enviar('usuario-b')).status, 200);
});
