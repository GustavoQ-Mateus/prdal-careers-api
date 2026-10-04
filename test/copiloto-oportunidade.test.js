require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ValidationPipe } = require('@nestjs/common');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, autenticado } = require('./helpers/app-teste');

async function subir(t) {
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { OportunidadesService } = require('../dist/oportunidades/oportunidades.service');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');

  const vagas = [
    { id: 'vaga-da-vitima', usuarioId: 'vitima' },
    { id: 'vaga-do-atacante', usuarioId: 'atacante' },
  ];
  const prisma = {
    vaga: { findFirst: async ({ where }) => vagas.find((v) => v.id === where.id && v.usuarioId === where.usuarioId) ?? null },
  };
  const oportunidades = { garantirVaga: OportunidadesService.prototype.garantirVaga.bind({ prisma }) };

  const conversaExistente = { _id: 'conversa-1', usuarioId: 'atacante', modo: 'assistido', oportunidadeId: 'vaga-do-atacante', mensagens: [], pendencia: null };
  const registro = { abertas: 0, alteracoes: 0 };
  const conversas = {
    abrir: async (_usuario, conversaId, modo, oportunidadeId) => {
      registro.abertas++;
      if (conversaId) {
        registro.alteracoes++;
        Object.assign(conversaExistente, { modo, ...(oportunidadeId ? { oportunidadeId } : {}) });
        return conversaExistente;
      }
      return { _id: 'nova', usuarioId: 'atacante', modo, oportunidadeId, mensagens: [], pendencia: null };
    },
    anexar: async () => {},
    definirPendencia: async () => {},
  };
  const ai = { copilotoTurnStream: async () => turnoTexto('ok') };
  const chat = new ChatService(conversas, ai, {}, oportunidades);

  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [CopilotoController],
    providers: [
      { provide: ChatService, useValue: chat },
      { provide: CapacidadesService, useValue: {} },
      { provide: ConversasService, useValue: conversas },
      { provide: require('../dist/cota/cota-tokens.service').CotaTokensService, useValue: { verificar: async () => {} } },
    ],
    configurar: (app) => app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })),
  });
  const enviar = (corpo) =>
    fetch(`${url}/copiloto/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...autenticado('atacante') },
      body: JSON.stringify(corpo),
    });
  return { enviar, registro, conversaExistente };
}

test('oportunidadeId inexistente retorna 404 sem criar conversa', async (t) => {
  const { enviar, registro } = await subir(t);
  const resposta = await enviar({ mensagem: 'oi', oportunidadeId: 'abc' });
  assert.equal(resposta.status, 404);
  assert.match((await resposta.json()).message, /oportunidade nao encontrada/);
  assert.equal(registro.abertas, 0);
});

test('oportunidade de outro usuario retorna 404 sem alterar a conversa', async (t) => {
  const { enviar, registro, conversaExistente } = await subir(t);
  const resposta = await enviar({ mensagem: 'oi', conversaId: 'conversa-1', oportunidadeId: 'vaga-da-vitima' });
  assert.equal(resposta.status, 404);
  assert.equal(registro.alteracoes, 0);
  assert.equal(conversaExistente.oportunidadeId, 'vaga-do-atacante');
});

test('oportunidade propria segue para o chat', async (t) => {
  const { enviar, registro } = await subir(t);
  const resposta = await enviar({ mensagem: 'oi', oportunidadeId: 'vaga-do-atacante' });
  assert.equal(resposta.status, 201);
  assert.match(resposta.headers.get('content-type'), /text\/event-stream/);
  assert.match(await resposta.text(), /event: fim|event: texto|ok/);
  assert.equal(registro.abertas, 1);
});
