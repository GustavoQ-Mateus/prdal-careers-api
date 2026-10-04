const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');
const { prepararArgsTool } = require('../dist/copiloto/tool-args');
const { validarArgs } = require('../dist/copiloto/tool-executor');
const { TOOLS_POR_NOME } = require('../dist/copiloto/tools');

test('tipo do proximo passo nao e inferido do titulo: o enum do schema decide', async () => {
  for (const tipo of ['Enviar mensagem ao recrutador', 'verificar status', undefined]) {
    const args = prepararArgsTool({
      tool: 'definir_proximo_passo',
      args: { titulo: 'Enviar mensagem ao recrutador', tipo },
      oportunidadeId: 'vaga-1',
    });
    assert.equal(args.tipo, tipo);
    assert.equal(args.oportunidadeId, 'vaga-1');
    assert.match(await validarArgs(TOOLS_POR_NOME.get('definir_proximo_passo'), args), /tipo: deve ser um destes valores/);
  }
});

test('oportunidade em foco so preenche tool que aceita o campo', () => {
  const nota = prepararArgsTool({ tool: 'registrar_nota', args: { descricao: 'x' }, oportunidadeId: 'vaga-1' });
  assert.equal(nota.oportunidadeId, 'vaga-1');
  const registro = prepararArgsTool({ tool: 'registrar_oportunidade', args: { titulo: 'a' }, oportunidadeId: 'vaga-1' });
  assert.equal(registro.oportunidadeId, undefined);
  const explicita = prepararArgsTool({ tool: 'buscar_oportunidade', args: { oportunidadeId: 'outra' }, oportunidadeId: 'vaga-1' });
  assert.equal(explicita.oportunidadeId, 'outra');
  const candidatura = prepararArgsTool({ tool: 'registrar_candidatura', args: {}, oportunidadeId: 'vaga-1' });
  assert.equal(candidatura.vagaId, 'vaga-1');
});

test('preparar args nao le o historico da conversa', () => {
  const fonte = require('node:fs').readFileSync(require.resolve('../dist/copiloto/tool-args'), 'utf8');
  assert.doesNotMatch(fonte, /JSON\.parse|mensagens|leuAnalise|leuCurriculo|TOOLS_APOS_ETAPA_3/);
});

test('ChatService nao emite confirmacao para escrita invalida', async () => {
  const conversa = {
    _id: 'conversa-1',
    usuarioId: 'usuario-1',
    modo: 'assistido',
    oportunidadeId: 'vaga-1',
    mensagens: [],
    pendencia: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };
  const conversas = {
    abrir: async () => conversa,
    anexar: async () => {},
    definirPendencia: async () => {
      throw new Error('nao deve criar pendencia para escrita invalida');
    },
  };
  const turnos = [
    turnoTool('definir_proximo_passo', {
      titulo: 'Verificar status da geração do currículo',
      tipo: 'verificar status',
    }),
    turnoTexto('Vou consultar a geração pela tool correta.'),
  ];
  const payloads = [];
  const ai = { copilotoTurnStream: async (payload) => { payloads.push(structuredClone(payload)); return turnos.shift(); } };
  const executor = {
    executar: () => {
      throw new Error('nao deve executar escrita invalida');
    },
  };
  const eventos = [];
  const res = {
    setHeader() {},
    flushHeaders() {}, on() {},
    write(chunk) {
      eventos.push(chunk);
    },
    end() {},
  };

  await new ChatService(conversas, ai, executor).chat(
    res,
    { userId: 'usuario-1' },
    { mensagem: 'acompanhe a geração', modo: 'assistido' },
  );

  const saida = eventos.join('');
  assert.doesNotMatch(saida, /event: confirmacao/);
  assert.match(saida, /vieram incompletos ou inválidos/);
  const resultado = JSON.parse(saida.split('event: tool_resultado\ndata: ')[1].split('\n')[0]);
  assert.doesNotMatch(resultado.erro.mensagem, /definir_proximo_passo/);
  const paraModelo = payloads[1].trocas.flatMap((t) => t.mensagens).at(-1).content[0];
  assert.equal(paraModelo.is_error, true);
  assert.match(paraModelo.content, /argumentos inválidos para definir_proximo_passo: tipo: deve ser um destes valores/);
});
