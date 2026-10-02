const assert = require('node:assert/strict');
const test = require('node:test');
const { of } = require('rxjs');
const { ChatService, exigeConfirmacao } = require('../dist/copiloto/chat.service');
const { TOOLS_POR_NOME } = require('../dist/copiloto/tools');

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

function conversaFalsa(modo) {
  return {
    _id: 'conversa-1',
    usuarioId: 'usuario-1',
    modo,
    oportunidadeId: null,
    mensagens: [],
    pendencia: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };
}

function conversasFalsas(conversa, modos) {
  return {
    abrir: async (_usuario, _id, modo) => { modos.push(modo); conversa.modo = modo; return conversa; },
    anexar: async (_id, mensagem) => { conversa.mensagens.push(mensagem); },
    definirPendencia: async (_id, pendencia) => { conversa.pendencia = pendencia; },
    confirmarPendencia: async (_id, callId) => (conversa.pendencia?.callId === callId ? { ...conversa.pendencia, executando: true } : null),
    registrarConfirmacao: async () => {},
    buscarConfirmacao: async () => null,
    atualizarOportunidade: async (_id, oportunidadeId) => { conversa.oportunidadeId = oportunidadeId; },
  };
}

function confirmacaoPendente(res) {
  const bloco = res.eventos.find((evento) => evento.startsWith('event: confirmacao'));
  assert.ok(bloco, 'esperava um evento de confirmacao');
  return JSON.parse(bloco.split('data: ')[1]).callId;
}

test('chat sem modo roda em assistido e pede confirmacao antes de escrever', async () => {
  const modos = [];
  const conversa = conversaFalsa('assistido');
  const chamadas = [];
  const ai = { copilotoTurn: async () => ({ tipo: 'tool_call', tool: 'registrar_oportunidade', args: { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' } }) };
  const http = { request: (request) => { chamadas.push(request); return of({ data: {} }); } };
  const res = response();

  await new ChatService(conversasFalsas(conversa, modos), ai, http).chat(res, { userId: 'usuario-1' }, 'Bearer teste', { mensagem: 'Registre a vaga.' });

  assert.deepEqual(modos, ['assistido']);
  assert.equal(chamadas.length, 0);
  assert.ok(confirmacaoPendente(res));
});

test('reaproveita oportunidade na mesma conversa no segundo registro confirmado', async () => {
  const conversa = conversaFalsa('assistido');
  const turnos = [
    { tipo: 'tool_call', tool: 'registrar_oportunidade', args: { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' } },
    { tipo: 'tool_call', tool: 'registrar_oportunidade', args: { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' } },
    { tipo: 'texto', texto: 'Oportunidade pronta.' },
  ];
  const chamadas = [];
  const ai = { copilotoTurn: async () => turnos.shift() };
  const http = {
    request: (request) => {
      chamadas.push(request);
      return of({ data: { id: 'vaga-1', titulo: 'Vaga', empresa: 'Acme' } });
    },
  };
  const service = new ChatService(conversasFalsas(conversa, []), ai, http);
  const usuario = { userId: 'usuario-1' };

  const primeiro = response();
  await service.chat(primeiro, usuario, 'Bearer teste', { mensagem: 'Registre duas vezes por engano.' });
  const segundo = response();
  await service.chat(segundo, usuario, 'Bearer teste', { conversaId: conversa._id, confirmacao: { callId: confirmacaoPendente(primeiro), decisao: 'confirmar' } });
  const terceiro = response();
  await service.chat(terceiro, usuario, 'Bearer teste', { conversaId: conversa._id, confirmacao: { callId: confirmacaoPendente(segundo), decisao: 'confirmar' } });

  assert.equal(chamadas.filter((request) => request.method === 'POST').length, 1);
  assert.equal(chamadas.filter((request) => request.method === 'GET').length, 1);
  assert.match(terceiro.eventos.join(''), /reaproveitada/);
  assert.equal(conversa.oportunidadeId, 'vaga-1');
});

test('autopiloto executa sem confirmacao apenas leituras e registrar_nota', () => {
  for (const tool of TOOLS_POR_NOME.values()) {
    const semConfirmacao = !exigeConfirmacao(tool, 'autopiloto');
    const permitido = tool.efeito !== 'escrita' || tool.nome === 'registrar_nota';
    assert.equal(semConfirmacao, permitido, tool.nome);
    assert.equal(exigeConfirmacao(tool, 'assistido'), tool.efeito === 'escrita', tool.nome);
  }
});

test('gerar_curriculo pede confirmacao inclusive no autopiloto', async () => {
  const conversa = {
    ...conversaFalsa('autopiloto'),
    oportunidadeId: 'vaga-1',
    mensagens: [{ papel: 'tool', tool: 'analisar_ats', conteudo: JSON.stringify({ score: 67, veredicto: 'Cobertura media.' }) }],
  };
  const chamadas = [];
  const ai = { copilotoTurn: async () => ({ tipo: 'tool_call', tool: 'gerar_curriculo', args: { oportunidadeId: 'vaga-1' } }) };
  const http = { request: (request) => { chamadas.push(request); return of({ data: {} }); } };
  const res = response();

  await new ChatService(conversasFalsas(conversa, []), ai, http).chat(res, { userId: 'usuario-1' }, 'Bearer teste', { modo: 'autopiloto', mensagem: 'Gere o curriculo.' });

  assert.equal(chamadas.length, 0);
  assert.ok(confirmacaoPendente(res));
  assert.equal(conversa.pendencia.tool, 'gerar_curriculo');
});
