const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');
const { paraTrocas } = require('../dist/copiloto/historico');

const historico = [
  { papel: 'user', conteudo: 'registre a vaga' },
  { papel: 'assistant', conteudo: '', blocos: [{ type: 'tool_use', id: 'toolu_1', name: 'registrar_oportunidade', input: {} }] },
  { papel: 'user', conteudo: 'deixa pra depois' },
  { papel: 'assistant', conteudo: 'Tudo bem.' },
  { papel: 'evento', conteudo: 'erro', dados: { evento: 'erro' } },
  { papel: 'user', conteudo: 'leia meu perfil' },
  { papel: 'assistant', conteudo: '', blocos: [{ type: 'tool_use', id: 'toolu_2', name: 'ler_perfil', input: {} }] },
  { papel: 'tool', tool: 'ler_perfil', conteudo: '{"nome":"Pessoa"}', dados: { callId: 'toolu_2' } },
];

test('trocas comecam em mensagem do candidato e nunca separam tool_use do tool_result', () => {
  const trocas = paraTrocas(historico);
  assert.deepEqual(trocas.map((t) => t.indice), [0, 2, 5]);
  for (const troca of trocas) {
    assert.equal(troca.mensagens[0].role, 'user');
    assert.equal(troca.mensagens[0].content[0].type, 'text');
    const usos = troca.mensagens.flatMap((m) => m.content).filter((b) => b.type === 'tool_use').map((b) => b.id);
    const resultados = troca.mensagens.flatMap((m) => m.content).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id);
    assert.deepEqual(resultados, usos);
  }
  assert.equal(trocas[0].mensagens[2].content[0].is_error, true);
});

test('trocas antes do resumo nao sao enviadas', () => {
  assert.deepEqual(paraTrocas(historico, 5).map((t) => t.indice), [5]);
  assert.deepEqual(paraTrocas(historico, 2).map((t) => t.indice), [2, 5]);
});

function cenario(conversa) {
  const resumos = [];
  const conversas = {
    abrir: async () => conversa,
    anexar: async () => {},
    definirPendencia: async () => {},
    definirResumo: async (_id, resumo) => resumos.push(resumo),
  };
  const res = { setHeader() {}, flushHeaders() {}, on() {}, write() {}, end() {} };
  return { conversas, resumos, res };
}

test('resumo devolvido e persistido e o proximo turno so manda as trocas depois dele', async () => {
  const conversa = { id: 'c1', usuarioId: 'u1', modo: 'assistido', oportunidadeId: null, mensagens: historico.slice(0, 4), pendencia: null };
  const { conversas, resumos, res } = cenario(conversa);
  const payloads = [];
  const turnos = [
    { ...turnoTexto('Certo.'), resumo: { texto: 'Candidato adiou o registro.', ate: 4 } },
    turnoTexto('Seguimos.'),
  ];
  const ai = { copilotoTurnStream: async (payload) => { payloads.push(structuredClone(payload)); return turnos.shift(); } };
  const service = new ChatService(conversas, ai, { executar: async () => ({}) });

  await service.chat(res, { userId: 'u1' }, { mensagem: 'e a vaga de dados?' });
  assert.deepEqual(resumos, [{ texto: 'Candidato adiou o registro.', ate: 4 }]);
  assert.equal(payloads[0].resumo, null);
  assert.deepEqual(payloads[0].trocas.map((t) => t.indice), [0, 2, 4]);

  await service.chat(res, { userId: 'u1' }, { mensagem: 'ok' });
  assert.deepEqual(payloads[1].resumo, { texto: 'Candidato adiou o registro.', ate: 4 });
  assert.deepEqual(payloads[1].trocas.map((t) => t.indice), [4, 6]);
});

test('resultado de tool fica inteiro no historico, sem corte por caractere', async () => {
  const conversa = { id: 'c1', usuarioId: 'u1', modo: 'assistido', oportunidadeId: null, mensagens: [], pendencia: null };
  const { conversas, res } = cenario(conversa);
  const grande = { nome: 'Pessoa', resumo: 'a'.repeat(9000) };
  const turnos = [turnoTool('ler_perfil', {}, 'toolu_g'), turnoTexto('Li.')];
  const ai = { copilotoTurnStream: async () => turnos.shift() };

  await new ChatService(conversas, ai, { executar: async () => grande }).chat(res, { userId: 'u1' }, { mensagem: 'leia' });

  const tool = conversa.mensagens.find((m) => m.papel === 'tool');
  assert.equal(JSON.parse(tool.conteudo).resumo.length, 9000);
  assert.equal(tool.blocos[0].content, tool.conteudo);
  assert.doesNotMatch(tool.conteudo, /\.\.\.$/);
});
