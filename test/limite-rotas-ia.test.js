require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { UnauthorizedException, ValidationPipe } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, autenticado } = require('./helpers/app-teste');

test('rotas de IA e consulta do copiloto sao limitadas por usuario', async (t) => {
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { JANELAS, LIMITES } = require('../dist/limites/limite-requisicoes');
  const ok = async () => ({ ok: true });
  const capacidades = { keywordsPrevia: ok, consultarRag: ok, score: ok, mensagemRecrutador: ok, respostasFormulario: ok };
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [CopilotoController],
    providers: [
      { provide: ChatService, useValue: {} },
      { provide: CapacidadesService, useValue: capacidades },
      { provide: ConversasService, useValue: {} },
    ],
    configurar: (app) => app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })),
  });
  const rotas = [
    ['keywords-previa', { descricao: 'Vaga Python' }, LIMITES.ia.minuto],
    ['mensagem-recrutador', { oportunidadeId: 'op-1' }, LIMITES.ia.minuto],
    ['respostas-formulario', { oportunidadeId: 'op-1', campos: ['Por que?'] }, LIMITES.ia.minuto],
    ['score', { markdown: '# Nome' }, LIMITES.consulta.minuto],
    ['rag/consulta', { query: 'python' }, LIMITES.consulta.minuto],
  ];
  for (const [rota, corpo, limite] of rotas) {
    const enviar = (usuario) =>
      fetch(`${url}/copiloto/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...autenticado(usuario) },
        body: JSON.stringify(corpo),
      });
    for (let i = 0; i < limite; i++) assert.equal((await enviar('usuario-a')).status, 201, `${rota} ${i}`);
    const bloqueada = await enviar('usuario-a');
    assert.equal(bloqueada.status, 429, rota);
    assert.ok(Number(bloqueada.headers.get('retry-after')) > 0, rota);
    assert.equal((await enviar('usuario-b')).status, 201, `${rota} outro usuario`);
  }
});

test('analisar-ats e reprocessar-keywords usam o mesmo limitador por usuario', () => {
  const { OportunidadesController } = require('../dist/oportunidades/oportunidades.controller');
  const { LimiteRequisicoesGuard, LIMITES } = require('../dist/limites/limite-requisicoes');
  for (const [metodo, limite] of [['analisarAts', LIMITES.ia], ['reprocessarKeywords', LIMITES.lote]]) {
    const handler = OportunidadesController.prototype[metodo];
    assert.ok(Reflect.getMetadata(GUARDS_METADATA, handler).includes(LimiteRequisicoesGuard), metodo);
    assert.equal(Reflect.getMetadata('THROTTLER:LIMITminuto', handler), limite.minuto, metodo);
    assert.equal(Reflect.getMetadata('THROTTLER:LIMIThora', handler), limite.hora, metodo);
  }
});

async function subirLogin(t, env) {
  const { AuthController } = require('../dist/auth/auth.controller');
  const { AuthService } = require('../dist/auth/auth.service');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const { configurarProxy } = require('../dist/config/proxy');
  const auth = {
    login: async () => {
      throw new UnauthorizedException('credenciais invalidas');
    },
  };
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: auth }],
    sessoes: { familiaAtiva: async () => true },
    configurar: (app) => {
      configurarProxy(app, env);
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    },
  });
  return (ip) =>
    fetch(`${url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email: 'vitima@teste.dev', senha: 'errada' }),
    }).then((r) => r.status);
}

test('sem TRUST_PROXY o X-Forwarded-For forjado nao escapa do limite por IP', async (t) => {
  const login = await subirLogin(t, {});
  const status = [];
  for (let i = 0; i < 7; i++) status.push(await login(`203.0.113.${i}`));
  assert.deepEqual(status, [401, 401, 401, 401, 401, 429, 429]);
});

test('com TRUST_PROXY=1 o limite por IP usa o IP do cliente informado pelo proxy', async (t) => {
  const login = await subirLogin(t, { TRUST_PROXY: '1' });
  const status = [];
  for (let i = 0; i < 6; i++) status.push(await login('198.51.100.7'));
  assert.deepEqual(status, [401, 401, 401, 401, 401, 429]);
  assert.equal(await login('198.51.100.8'), 401);
});

test('TRUST_PROXY aceita so numero de saltos positivo', () => {
  const { saltosDeProxy } = require('../dist/config/proxy');
  assert.equal(saltosDeProxy({}), 0);
  assert.equal(saltosDeProxy({ TRUST_PROXY: '2' }), 2);
  for (const valor of ['0', '-1', 'true', '1.5', 'loopback']) assert.equal(saltosDeProxy({ TRUST_PROXY: valor }), 0, valor);
});
