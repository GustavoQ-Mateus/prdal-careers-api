const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');
const { paraMensagensNativas } = require('../dist/copiloto/historico');

function assertPareado(mensagens) {
  assert.equal(mensagens[0].role, 'user');
  for (let i = 1; i < mensagens.length; i++) {
    assert.notEqual(mensagens[i].role, mensagens[i - 1].role, `papeis repetidos em ${i}`);
  }
  mensagens.forEach((mensagem, i) => {
    const usos = mensagem.content.filter((b) => b.type === 'tool_use').map((b) => b.id);
    if (usos.length === 0) return;
    const seguinte = mensagens[i + 1];
    assert.ok(seguinte, 'tool_use sem resposta');
    const resultados = seguinte.content.filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id);
    assert.deepEqual([...resultados].sort(), [...usos].sort());
    assert.equal(seguinte.content[0].type, 'tool_result');
  });
}

test('conversa antiga achatada vira blocos nativos sem perder mensagem', () => {
  const antigas = [
    { papel: 'user', conteudo: 'Registre a vaga de backend' },
    { papel: 'tool', tool: 'registrar_oportunidade', conteudo: '{"id":"vaga-1"}', dados: { callId: 'c-1', args: { titulo: 'Backend' }, ok: true } },
    { papel: 'assistant', conteudo: 'Registrei a vaga.' },
    { papel: 'evento', conteudo: 'erro qualquer', dados: { evento: 'erro', escopo: 'interno' } },
    { papel: 'tool', tool: 'analisar_ats', conteudo: 'falha: servico indisponivel', dados: { ok: false } },
    { papel: 'tool', tool: 'buscar_curriculo', conteudo: '{"id":"cv-1"}', dados: { callId: 'c-3', origem: 'geracao_assincrona' } },
    { papel: 'assistant', conteudo: 'Curriculo pronto.' },
    { papel: 'user', conteudo: 'Obrigado' },
  ];
  const nativas = paraMensagensNativas(antigas);
  assertPareado(nativas);
  const blocos = nativas.flatMap((m) => m.content);
  assert.equal(blocos.filter((b) => b.type === 'text').length, 4);
  assert.equal(blocos.filter((b) => b.type === 'tool_result').length, 3);
  const usos = blocos.filter((b) => b.type === 'tool_use');
  assert.deepEqual(usos.map((b) => b.name), ['registrar_oportunidade', 'analisar_ats', 'buscar_curriculo']);
  assert.deepEqual(usos[0].input, { titulo: 'Backend' });
  assert.equal(usos[0].id, 'c-1');
  assert.equal(usos[1].id, 'legado_4');
  const falha = blocos.find((b) => b.type === 'tool_result' && b.tool_use_id === 'legado_4');
  assert.equal(falha.is_error, true);
  assert.doesNotMatch(JSON.stringify(nativas), /erro qualquer/);
});

test('tool_use sem resultado ganha resultado de erro antes da proxima mensagem', () => {
  const nativas = paraMensagensNativas([
    { papel: 'user', conteudo: 'registre' },
    { papel: 'assistant', conteudo: '', blocos: [{ type: 'tool_use', id: 'toolu_a', name: 'registrar_oportunidade', input: {} }] },
    { papel: 'user', conteudo: 'na verdade, deixa' },
  ]);
  assertPareado(nativas);
  const resultado = nativas[2].content[0];
  assert.equal(resultado.tool_use_id, 'toolu_a');
  assert.equal(resultado.is_error, true);
  assert.equal(nativas[2].content[1].text, 'na verdade, deixa');
});

function conversaFalsa() {
  const conversa = {
    _id: 'conversa-1',
    usuarioId: 'usuario-1',
    modo: 'assistido',
    oportunidadeId: null,
    mensagens: [],
    pendencia: null,
  };
  const conversas = {
    abrir: async () => conversa,
    anexar: async () => {},
    definirPendencia: async (_id, pendencia) => { conversa.pendencia = pendencia; },
    confirmarPendencia: async (_id, callId) => (conversa.pendencia?.callId === callId ? { ...conversa.pendencia, executando: true } : null),
    registrarConfirmacao: async () => {},
    buscarConfirmacao: async () => null,
  };
  return { conversa, conversas };
}

function resposta() {
  const eventos = [];
  return { eventos, setHeader() {}, flushHeaders() {}, write(c) { eventos.push(c); }, end() {} };
}

test('persiste o par tool_use e tool_result com o id do modelo e reenvia nativo', async () => {
  const { conversa, conversas } = conversaFalsa();
  const enviados = [];
  const turnos = [turnoTool('ler_perfil', {}, 'toolu_perfil_1'), turnoTexto('Li seu perfil.')];
  const ai = { copilotoTurn: async (payload) => { enviados.push(structuredClone(payload)); return turnos.shift(); } };
  const executor = { executar: async () => ({ nome: 'Pessoa', resumo: 'Back-end' }) };
  const res = resposta();

  await new ChatService(conversas, ai, executor).chat(res, { userId: 'usuario-1' }, { mensagem: 'leia meu perfil' });

  const assistente = conversa.mensagens.find((m) => m.papel === 'assistant' && m.blocos?.some((b) => b.type === 'tool_use'));
  assert.deepEqual(assistente.blocos, [{ type: 'tool_use', id: 'toolu_perfil_1', name: 'ler_perfil', input: {} }]);
  const tool = conversa.mensagens.find((m) => m.papel === 'tool');
  assert.equal(tool.dados.callId, 'toolu_perfil_1');
  assert.equal(tool.blocos[0].type, 'tool_result');
  assert.equal(tool.blocos[0].tool_use_id, 'toolu_perfil_1');
  assert.match(tool.blocos[0].content, /Back-end/);

  const segundo = enviados[1].mensagens;
  assertPareado(segundo);
  assert.deepEqual(segundo.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(segundo[2].content[0].tool_use_id, 'toolu_perfil_1');
  assert.ok(enviados[1].tools.every((t) => t.name && t.input_schema && t.input_schema.type === 'object'));
  assert.match(res.eventos.join(''), /"callId":"toolu_perfil_1"/);
});

test('falha da tool volta como tool_result com is_error', async () => {
  const { conversa, conversas } = conversaFalsa();
  const enviados = [];
  const turnos = [turnoTool('ler_perfil', {}, 'toolu_falha'), turnoTexto('Nao consegui ler.')];
  const ai = { copilotoTurn: async (payload) => { enviados.push(structuredClone(payload)); return turnos.shift(); } };
  const executor = { executar: async () => { throw new Error('banco fora do ar'); } };

  await new ChatService(conversas, ai, executor).chat(resposta(), { userId: 'usuario-1' }, { mensagem: 'leia' });

  const resultado = enviados[1].mensagens[2].content[0];
  assert.equal(resultado.tool_use_id, 'toolu_falha');
  assert.equal(resultado.is_error, true);
  assert.match(resultado.content, /banco fora do ar/);
  assert.equal(conversa.mensagens.filter((m) => m.papel === 'assistant').length, 2);
});

test('recusa da escrita fecha o tool_use pendente com o mesmo id', async () => {
  const { conversa, conversas } = conversaFalsa();
  const enviados = [];
  const turnos = [
    turnoTool('registrar_oportunidade', { titulo: 'V', empresa: 'E', descricao: 'D' }, 'toolu_escrita'),
    turnoTexto('Tudo bem, nao registrei.'),
  ];
  const ai = { copilotoTurn: async (payload) => { enviados.push(structuredClone(payload)); return turnos.shift(); } };
  const service = new ChatService(conversas, ai, { executar: () => { throw new Error('nao deve escrever'); } });

  await service.chat(resposta(), { userId: 'usuario-1' }, { mensagem: 'registre' });
  assert.equal(conversa.pendencia.callId, 'toolu_escrita');
  await service.chat(resposta(), { userId: 'usuario-1' }, { conversaId: 'conversa-1', confirmacao: { callId: 'toolu_escrita', decisao: 'recusar' } });

  const ultimo = enviados[1].mensagens;
  assertPareado(ultimo);
  const resultado = ultimo[2].content[0];
  assert.equal(resultado.tool_use_id, 'toolu_escrita');
  assert.equal(resultado.is_error, true);
  assert.match(resultado.content, /recusou/);
});
