require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } = require('@nestjs/common/constants');
const { RequestMethod } = require('@nestjs/common');
const { ContaService } = require('../dist/conta/conta.service');
const { ConsentimentoGuard } = require('../dist/conta/consentimento.guard');
const { OportunidadesController } = require('../dist/oportunidades/oportunidades.controller');
const { CopilotoController } = require('../dist/copiloto/copiloto.controller');

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
