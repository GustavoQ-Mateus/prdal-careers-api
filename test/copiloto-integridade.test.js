const assert = require('node:assert/strict');
const test = require('node:test');
const { of } = require('rxjs');
const { ChatService } = require('../dist/copiloto/chat.service');

function response() {
  const eventos = [];
  return {
    eventos,
    setHeader() {},
    flushHeaders() {},
    write(chunk) { eventos.push(chunk); },
    end() {},
  };
}

test('reaproveita oportunidade na mesma conversa no segundo registro', async () => {
  const conversa = {
    _id: 'conversa-idempotente',
    usuarioId: 'usuario-1',
    modo: 'autopiloto',
    oportunidadeId: null,
    mensagens: [],
    pendencia: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };
  const turnos = [
    { tipo: 'tool_call', tool: 'registrar_oportunidade', args: { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' } },
    { tipo: 'tool_call', tool: 'registrar_oportunidade', args: { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' } },
    { tipo: 'texto', texto: 'Oportunidade pronta.' },
  ];
  const chamadas = [];
  const conversas = {
    abrir: async () => conversa,
    anexar: async () => {},
    atualizarOportunidade: async (_id, oportunidadeId) => { conversa.oportunidadeId = oportunidadeId; },
  };
  const ai = { copilotoTurn: async () => turnos.shift() };
  const http = {
    request: (request) => {
      chamadas.push(request);
      if (request.method === 'POST') return of({ data: { id: 'vaga-1', titulo: 'Vaga', empresa: 'Acme' } });
      return of({ data: { id: 'vaga-1', titulo: 'Vaga', empresa: 'Acme' } });
    },
  };
  const res = response();

  await new ChatService(conversas, ai, http).chat(
    res,
    { userId: 'usuario-1' },
    'Bearer teste',
    { modo: 'autopiloto', mensagem: 'Registre duas vezes por engano.' },
  );

  assert.equal(chamadas.filter((request) => request.method === 'POST').length, 1);
  assert.equal(chamadas.filter((request) => request.method === 'GET').length, 1);
  assert.match(res.eventos.join(''), /reaproveitada/);
  assert.equal(conversa.oportunidadeId, 'vaga-1');
});

