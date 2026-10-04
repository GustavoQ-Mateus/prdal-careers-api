const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService, exigeConfirmacao } = require('../dist/copiloto/chat.service');
const { TOOLS_POR_NOME } = require('../dist/copiloto/tools');
const { pipelineMemoria } = require('./helpers/pipeline-memoria');

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
  const ai = { copilotoTurn: async () => turnoTool('registrar_oportunidade', { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' }) };
  const executor = { executar: async (_u, tool) => { chamadas.push(tool.nome); return {}; } };
  const res = response();

  await new ChatService(conversasFalsas(conversa, modos), ai, executor).chat(res, { userId: 'usuario-1' }, { mensagem: 'Registre a vaga.' });

  assert.deepEqual(modos, ['assistido']);
  assert.equal(chamadas.length, 0);
  assert.ok(confirmacaoPendente(res));
});

test('reaproveita oportunidade na mesma conversa no segundo registro confirmado', async () => {
  const conversa = conversaFalsa('assistido');
  const turnos = [
    turnoTool('registrar_oportunidade', { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' }),
    turnoTool('registrar_oportunidade', { titulo: 'Vaga', empresa: 'Acme', descricao: 'Descricao' }),
    turnoTexto('Oportunidade pronta.'),
  ];
  const chamadas = [];
  const ai = { copilotoTurn: async () => turnos.shift() };
  const executor = {
    executar: async (_u, tool) => {
      chamadas.push(tool.nome);
      return { id: 'vaga-1', titulo: 'Vaga', empresa: 'Acme' };
    },
  };
  const service = new ChatService(conversasFalsas(conversa, []), ai, executor);
  const usuario = { userId: 'usuario-1' };

  const primeiro = response();
  await service.chat(primeiro, usuario, { mensagem: 'Registre duas vezes por engano.' });
  const segundo = response();
  await service.chat(segundo, usuario, { conversaId: conversa._id, confirmacao: { callId: confirmacaoPendente(primeiro), decisao: 'confirmar' } });
  const terceiro = response();
  await service.chat(terceiro, usuario, { conversaId: conversa._id, confirmacao: { callId: confirmacaoPendente(segundo), decisao: 'confirmar' } });

  assert.deepEqual(chamadas, ['registrar_oportunidade', 'buscar_oportunidade']);
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
  };
  const { service: pipelineAts } = pipelineMemoria();
  await pipelineAts.aplicar('usuario-1', 'vaga-1', {
    tipo: 'analise_concluida',
    analise: { score: 67, keywordsEncontradas: [], keywordsCriticasAusentes: [], pontosEliminatorios: [], veredicto: 'Cobertura media.' },
  });
  const chamadas = [];
  const ai = { copilotoTurn: async () => turnoTool('gerar_curriculo', { oportunidadeId: 'vaga-1' }) };
  const executor = { executar: async (_u, tool) => { chamadas.push(tool.nome); return {}; } };
  const res = response();

  await new ChatService(conversasFalsas(conversa, []), ai, executor, {}, pipelineAts).chat(res, { userId: 'usuario-1' }, { modo: 'autopiloto', mensagem: 'Gere o curriculo.' });

  assert.equal(chamadas.length, 0);
  assert.ok(confirmacaoPendente(res));
  assert.equal(conversa.pendencia.tool, 'gerar_curriculo');
  assert.equal((await pipelineAts.situacao('usuario-1', 'vaga-1')).estado, 'AGUARDANDO_CONFIRMACAO');
});
