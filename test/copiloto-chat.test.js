const assert = require('node:assert/strict');
const test = require('node:test');
const { ChatService } = require('../dist/copiloto/chat.service');
const {
  normalizarTipoAcao,
  prepararArgsTool,
} = require('../dist/copiloto/tool-args');

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

test('normaliza intencoes comuns para os enums de acao', () => {
  const casos = [
    ['enviar mensagem ao recrutador', 'ENVIAR_CANDIDATURA'],
    ['gerar currículo', 'GERAR_CURRICULO'],
    ['revisar vaga e currículo', 'REVISAR_VAGA'],
    ['fazer follow-up', 'FAZER_FOLLOW_UP'],
    ['preparar entrevista', 'PREPARAR_ENTREVISTA'],
    ['enviar material ao recrutador', 'ENVIAR_MATERIAL'],
    ['ação sem classificação', 'OUTRO'],
  ];

  for (const [entrada, esperado] of casos) {
    assert.equal(normalizarTipoAcao(entrada, ''), esperado);
  }
});

test('normaliza tipo textual ou ausente antes da confirmacao', () => {
  for (const tipo of ['Enviar mensagem ao recrutador', undefined]) {
    const resultado = prepararArgsTool({
      tool: 'definir_proximo_passo',
      args: { titulo: 'Enviar mensagem ao recrutador', tipo },
      oportunidadeId: 'vaga-1',
      mensagens: [leituraFinal],
    });

    assert.equal(resultado.erro, null);
    assert.equal(resultado.args.tipo, 'ENVIAR_CANDIDATURA');
    assert.equal(resultado.args.oportunidadeId, 'vaga-1');
  }
});

test('rejeita status de geracao como agenda e acao externa antes da Etapa 3', () => {
  const statusAgenda = prepararArgsTool({
    tool: 'definir_proximo_passo',
    args: { titulo: 'Verificar status da geração do currículo' },
    oportunidadeId: 'vaga-1',
    mensagens: [],
  });
  assert.match(statusAgenda.erro, /status_geracao/);

  const externa = prepararArgsTool({
    tool: 'definir_proximo_passo',
    args: { titulo: 'Enviar mensagem ao recrutador', tipo: 'texto livre' },
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

test('direciona preparacao de mensagem para a tool de redacao', () => {
  const resultado = prepararArgsTool({
    tool: 'definir_proximo_passo',
    args: { titulo: 'Preparar mensagem ao recrutador' },
    oportunidadeId: 'vaga-1',
    mensagens: [leituraFinal],
  });

  assert.match(resultado.erro, /redigir_mensagem_recrutador/);
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
    {
      tipo: 'tool_call',
      tool: 'definir_proximo_passo',
      args: {
        titulo: 'Verificar status da geração do currículo',
        tipo: 'verificar status',
      },
    },
    { tipo: 'texto', texto: 'Vou consultar a geração pela tool correta.' },
  ];
  const ai = { copilotoTurn: async () => turnos.shift() };
  const http = {
    request: () => {
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

  await new ChatService(conversas, ai, http).chat(
    res,
    { userId: 'usuario-1' },
    'Bearer teste',
    { mensagem: 'acompanhe a geração', modo: 'assistido' },
  );

  const saida = eventos.join('');
  assert.doesNotMatch(saida, /event: confirmacao/);
  assert.match(saida, /status_geracao/);
});
