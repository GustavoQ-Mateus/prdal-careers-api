const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');
const { prepararArgsTool } = require('../dist/copiloto/tool-args');
const { validarArgs } = require('../dist/copiloto/tool-executor');
const { TOOLS_POR_NOME } = require('../dist/copiloto/tools');

const leituraFinal = {
  papel: 'tool',
  tool: 'buscar_curriculo',
  conteudo: JSON.stringify({
    id: 'cv-1',
    vagaId: 'vaga-1',
    score: 82,
    breakdown: { keywordMatch: 35 },
  }),
};

test('tipo do proximo passo nao e inferido do titulo: o enum do schema decide', async () => {
  for (const tipo of ['Enviar mensagem ao recrutador', 'verificar status', undefined]) {
    const resultado = prepararArgsTool({
      tool: 'definir_proximo_passo',
      args: { titulo: 'Enviar mensagem ao recrutador', tipo },
      oportunidadeId: 'vaga-1',
      mensagens: [leituraFinal],
    });
    assert.equal(resultado.args.tipo, tipo);
    assert.equal(resultado.args.oportunidadeId, 'vaga-1');
    assert.match(await validarArgs(TOOLS_POR_NOME.get('definir_proximo_passo'), resultado.args), /tipo: deve ser um destes valores/);
  }
});

test('titulo de agenda nao e barrado por regex; a acao externa ainda exige a Etapa 3', () => {
  for (const titulo of ['Verificar status da geração do currículo', 'Preparar mensagem ao recrutador']) {
    const interna = prepararArgsTool({
      tool: 'definir_proximo_passo',
      args: { titulo, tipo: 'REVISAR_VAGA' },
      oportunidadeId: 'vaga-1',
      mensagens: [],
    });
    assert.equal(interna.erro, null);
  }
});

test('oportunidade em foco so preenche tool que aceita o campo', () => {
  const nota = prepararArgsTool({ tool: 'registrar_nota', args: { descricao: 'x' }, oportunidadeId: 'vaga-1', mensagens: [] });
  assert.equal(nota.args.oportunidadeId, 'vaga-1');
  const registro = prepararArgsTool({ tool: 'registrar_oportunidade', args: { titulo: 'a' }, oportunidadeId: 'vaga-1', mensagens: [] });
  assert.equal(registro.args.oportunidadeId, undefined);
  const explicita = prepararArgsTool({ tool: 'buscar_oportunidade', args: { oportunidadeId: 'outra' }, oportunidadeId: 'vaga-1', mensagens: [] });
  assert.equal(explicita.args.oportunidadeId, 'outra');
});

test('acao externa antes da Etapa 3 e barrada', () => {
  const externa = prepararArgsTool({
    tool: 'definir_proximo_passo',
    args: { titulo: 'Enviar mensagem ao recrutador', tipo: 'ENVIAR_CANDIDATURA' },
    oportunidadeId: 'vaga-1',
    mensagens: [
      {
        papel: 'tool',
        tool: 'status_geracao',
        conteudo: JSON.stringify({ status: 'CONCLUIDA', curriculoId: 'cv-1' }),
      },
    ],
  });
  assert.equal(externa.args.tipo, 'ENVIAR_CANDIDATURA');
  assert.match(externa.erro, /buscar_curriculo/);
});

test('uma nova geracao invalida a leitura final de um ciclo anterior', () => {
  const resultado = prepararArgsTool({
    tool: 'redigir_mensagem_recrutador',
    args: {},
    oportunidadeId: 'vaga-1',
    mensagens: [
      leituraFinal,
      {
        papel: 'tool',
        tool: 'gerar_curriculo',
        conteudo: JSON.stringify({ jobId: 'job-2' }),
      },
      {
        papel: 'tool',
        tool: 'status_geracao',
        conteudo: JSON.stringify({ status: 'CONCLUIDA', curriculoId: 'cv-2' }),
      },
    ],
  });

  assert.match(resultado.erro, /buscar_curriculo/);
});

test('exige a analise ATS antes de iniciar a reescrita', () => {
  const semAnalise = prepararArgsTool({
    tool: 'gerar_curriculo',
    args: {},
    oportunidadeId: 'vaga-1',
    mensagens: [],
  });
  assert.match(semAnalise.erro, /Etapa 1/);

  const comAnalise = prepararArgsTool({
    tool: 'gerar_curriculo',
    args: {},
    oportunidadeId: 'vaga-1',
    mensagens: [{
      papel: 'tool',
      tool: 'analisar_ats',
      conteudo: JSON.stringify({ score: 67, veredicto: 'Prosseguir com ajustes.' }),
    }],
  });
  assert.equal(comAnalise.erro, null);
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
  const ai = { copilotoTurn: async () => turnos.shift() };
  const executor = {
    executar: () => {
      throw new Error('nao deve executar escrita invalida');
    },
  };
  const eventos = [];
  const res = {
    setHeader() {},
    flushHeaders() {},
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
  assert.match(saida, /tipo: deve ser um destes valores/);
});
