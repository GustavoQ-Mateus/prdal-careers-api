require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } = require('@nestjs/common/constants');
const { RequestMethod } = require('@nestjs/common');
const { ContaService } = require('../dist/conta/conta.service');
const { ConsentimentoGuard } = require('../dist/conta/consentimento.guard');
const { OportunidadesController } = require('../dist/oportunidades/oportunidades.controller');
const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, autenticado } = require('./helpers/app-teste');

test('todas as rotas que enviam dados pessoais ao modelo exigem consentimento', () => {
  const rotas = new Set();
  for (const controller of [OportunidadesController, CopilotoController]) {
    const prefixo = Reflect.getMetadata(PATH_METADATA, controller);
    for (const nome of Object.getOwnPropertyNames(controller.prototype)) {
      const metodo = controller.prototype[nome];
      if (typeof metodo !== 'function' || Reflect.getMetadata(METHOD_METADATA, metodo) !== RequestMethod.POST) continue;
      const guards = Reflect.getMetadata(GUARDS_METADATA, metodo) ?? [];
      if (guards.includes(ConsentimentoGuard)) rotas.add(`POST /${prefixo}/${Reflect.getMetadata(PATH_METADATA, metodo)}`);
    }
  }
  assert.deepEqual([...rotas].sort(), [
    'POST /oportunidades/:id/gerar-cv',
    'POST /copiloto/chat',
    'POST /copiloto/mensagem-recrutador',
    'POST /copiloto/respostas-formulario',
  ].sort());
});

test('aceite e idempotente e revogacao volta a bloquear', async () => {
  const usuario = { consentimentoLlmEm: null };
  const prisma = { usuario: {
    updateMany: async ({ where, data }) => {
      if (where.consentimentoLlmEm === null && usuario.consentimentoLlmEm) return { count: 0 };
      Object.assign(usuario, data);
      return { count: 1 };
    },
    findUnique: async () => usuario,
  } };
  const conta = new ContaService(prisma);
  const guard = new ConsentimentoGuard(prisma);
  const contexto = { switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'u1' } }) }) };
  await assert.rejects(guard.canActivate(contexto), { constructor: require('../dist/conta/consentimento.guard').ConsentimentoPendente });
  await conta.consentir('u1');
  const aceitoEm = usuario.consentimentoLlmEm;
  await conta.consentir('u1');
  assert.equal(usuario.consentimentoLlmEm, aceitoEm);
  assert.equal(await guard.canActivate(contexto), true);
  await conta.revogar('u1');
  await assert.rejects(guard.canActivate(contexto), /Aceite o envio/);
});

test('quatro rotas recusam antes da chamada, aceitam apos consentir e voltam a recusar', async (t) => {
  const { ContaController } = require('../dist/conta/conta.controller');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { CurriculosService } = require('../dist/curriculos/curriculos.service');
  const { OportunidadesService } = require('../dist/oportunidades/oportunidades.service');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { TurnosService } = require('../dist/copiloto/turnos.service');
  const { CotaTokensService } = require('../dist/cota/cota-tokens.service');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const { FiltroErros } = require('../dist/observabilidade/erros');
  const usuario = { consentimentoLlmEm: null };
  const chamadas = [];
  const prisma = { usuario: {
    findUnique: async () => usuario,
    updateMany: async ({ data }) => { Object.assign(usuario, data); return { count: 1 }; },
  } };
  const conta = new ContaService(prisma, {}, {});
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [ContaController, OportunidadesController, CopilotoController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: ContaService, useValue: conta },
      { provide: OportunidadesService, useValue: {} },
      { provide: CurriculosService, useValue: { gerar: async () => { chamadas.push('cv'); return { jobId: 'g1' }; } } },
      { provide: ChatService, useValue: { chat: async (res) => { chamadas.push('chat'); res.end('ok'); } } },
      { provide: CapacidadesService, useValue: {
        mensagemRecrutador: async () => { chamadas.push('mensagem'); return { ok: true }; },
        respostasFormulario: async () => { chamadas.push('respostas'); return { ok: true }; },
      } },
      { provide: ConversasService, useValue: {} },
      { provide: TurnosService, useValue: {} },
      { provide: CotaTokensService, useValue: { verificar: async () => {} } },
    ],
    configurar: (app) => app.useGlobalFilters(new FiltroErros()),
  });
  const chamar = (rota) => fetch(`${url}${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...autenticado('u1') }, body: '{}' });
  const rotas = ['/oportunidades/v1/gerar-cv', '/copiloto/chat', '/copiloto/mensagem-recrutador', '/copiloto/respostas-formulario'];
  for (const rota of rotas) {
    const resposta = await chamar(rota);
    assert.equal(resposta.status, 403, rota);
    assert.equal((await resposta.json()).erro.codigo, 'consentimento_pendente');
  }
  assert.deepEqual(chamadas, []);
  assert.equal((await chamar('/conta/consentimento')).status, 204);
  for (const rota of rotas) assert.ok((await chamar(rota)).status < 300, rota);
  assert.deepEqual(chamadas, ['cv', 'chat', 'mensagem', 'respostas']);
  assert.equal((await fetch(`${url}/conta/consentimento`, { method: 'DELETE', headers: autenticado('u1') })).status, 204);
  for (const rota of rotas) assert.equal((await chamar(rota)).status, 403, rota);
  assert.equal(chamadas.length, 4);
});
