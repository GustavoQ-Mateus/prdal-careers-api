require('./helpers/armazenamento');
const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool, mensagensEnviadas } = require('./helpers/turnos');
const { pipelineMemoria } = require('./helpers/pipeline-memoria');
const { ChatService } = require('../dist/copiloto/chat.service');
const { ToolExecutor } = require('../dist/copiloto/tool-executor');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');
const { TOOLS_NATIVAS } = require('../dist/copiloto/tools');

const NOME_DE_TOOL = new RegExp(`\\b(${TOOLS_NATIVAS.map((t) => t.name).join('|')})\\b`);

const analiseInicial = {
  score: 48,
  keywordsEncontradas: ['Java'],
  keywordsCriticasAusentes: ['Docker'],
  pontosEliminatorios: [],
  veredicto: 'Cobertura media.',
  breakdown: { keywordMatch: 20, densidade: 10, secoes: 18, faltando: ['Docker'] },
};
const analiseFinal = { ...analiseInicial, score: 71, keywordsEncontradas: ['Java', 'Docker'], keywordsCriticasAusentes: [] };

function ambiente({ falharGeracao = false } = {}) {
  const { banco, service: pipelineAts } = pipelineMemoria();
  const vaga = { id: 'vaga-1', usuarioId: 'usuario-1', titulo: 'Dev', empresa: 'Acme', descricao: 'Java e Docker', keywordsStatus: 'VALIDAS', keywords: [{ termo: 'Java', peso: 1 }] };
  const curriculos = [];
  const geracoes = banco.geracoes;
  Object.assign(banco, {
    vaga: { ...banco.vaga, findFirst: async ({ where }) => (where.id === vaga.id && where.usuarioId === vaga.usuarioId ? vaga : null) },
    perfilMestre: { findUnique: async () => ({ usuarioId: 'usuario-1', nome: 'Pessoa' }) },
    geracaoCurriculo: {
      findFirst: async ({ where }) =>
        [...geracoes].reverse().find(
          (g) => g.usuarioId === where.usuarioId && g.vagaId === where.vagaId && (!where.status?.in || where.status.in.includes(g.status)),
        ) ?? null,
      create: async ({ data }) => {
        const geracao = { id: `job-${geracoes.length + 1}`, status: 'PENDENTE', curriculoId: null, criadoEm: new Date(), ...data };
        geracoes.push(geracao);
        return geracao;
      },
      findUnique: async ({ where }) => {
        const geracao = geracoes.find((g) => g.id === where.id);
        return geracao ? { ...geracao, vaga } : null;
      },
      update: async ({ where, data }) => Object.assign(geracoes.find((g) => g.id === where.id), data),
    },
    curriculo: {
      count: async () => curriculos.length,
      create: async ({ data }) => curriculos.push(data),
      findFirst: async ({ where }) => {
        const curriculo = curriculos.find((c) => c.id === where.id);
        return curriculo ? { ...curriculo, scoreBreakdown: curriculo.scoreBreakdown, geradoEm: new Date(), vaga, candidaturas: [] } : null;
      },
    },
  });
  const ai = {
    turnos: [],
    payloads: [],
    copilotoTurnStream: async (payload) => {
      ai.payloads.push(structuredClone(payload));
      const turno = ai.turnos.shift();
      if (!turno) throw new Error('turno nao programado');
      return turno;
    },
    contextQuery: async () => ({ chunks: [] }),
    analisarAts: async () => analiseInicial,
    generateCvPipeline: async () => {
      if (falharGeracao) throw new Error('ai-service indisponivel');
      return { markdown: '# Pessoa', analiseInicial, analiseFinal, degradacao: null };
    },
  };
  const doc = {
    renderPdf: async () => {
      throw new Error('doc-service fora');
    },
  };
  const anexos = [];
  const repositorioConversas = { anexarConclusaoGeracao: async (...args) => anexos.push(args) };
  const servicoCurriculos = new CurriculosService(banco, ai, doc, { registrar: async () => {} }, repositorioConversas, pipelineAts);
  const capacidades = {
    mensagemRecrutador: async () => ({ tipo: 'mensagem_recrutador', titulo: 'Mensagem', texto: 'Ola', destino: '' }),
  };
  const acoes = { criar: async (_u, _vagaId, dados) => ({ id: 'acao-1', ...dados }) };
  const candidaturas = { criar: async (_u, dados) => ({ id: 'cand-1', ...dados }) };
  const executor = new ToolExecutor(null, acoes, servicoCurriculos, null, null, null, candidaturas, capacidades, { verificar: async () => {} });
  const conversa = { id: 'conversa-1', usuarioId: 'usuario-1', modo: 'assistido', oportunidadeId: 'vaga-1', mensagens: [], pendencia: null };
  const conversas = {
    abrir: async () => conversa,
    anexar: async () => {},
    definirPendencia: async (_id, pendencia) => { conversa.pendencia = pendencia; },
    confirmarPendencia: async (_id, callId) => (conversa.pendencia?.callId === callId ? { ...conversa.pendencia, executando: true } : null),
    registrarConfirmacao: async () => {},
    buscarConfirmacao: async () => null,
    atualizarOportunidade: async () => {},
    definirResumo: async () => {},
  };
  const chat = new ChatService(conversas, ai, executor, { garantirVaga: async () => {} }, pipelineAts);
  return { banco, pipelineAts, ai, anexos, conversa, chat, geracoes };
}

function resposta() {
  const eventos = [];
  return { eventos, setHeader() {}, flushHeaders() {}, on() {}, write: (e) => eventos.push(e), end() {} };
}

function eventosDo(res, nome) {
  return res.eventos.filter((e) => e.startsWith(`event: ${nome}\n`)).map((e) => JSON.parse(e.split('data: ')[1]));
}

async function aguardar(condicao) {
  for (let i = 0; i < 200; i++) {
    if (condicao()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('condicao nao atingida');
}

const usuario = { userId: 'usuario-1' };

test('sequencia inteira pelo chat: fora de ordem, analise, confirmacao, geracao e narracao por eventos', async () => {
  const { banco, pipelineAts, ai, anexos, conversa, chat, geracoes } = ambiente();

  ai.turnos.push(
    turnoTool('gerar_curriculo', {}, 'toolu_cedo'),
    turnoTool('analisar_ats', {}, 'toolu_analise'),
  );
  const primeiro = resposta();
  await chat.chat(primeiro, usuario, { mensagem: 'Gere meu curriculo para esta vaga', oportunidadeId: 'vaga-1' });

  assert.deepEqual(ai.payloads.map((p) => p.pipelineAts.estado), ['SEM_ANALISE', 'SEM_ANALISE']);
  assert.match(ai.payloads[0].pipelineAts.descricao, /analisar_ats/);
  const foraDeOrdem = mensagensEnviadas(ai.payloads[1]).at(-1).content[0];
  assert.equal(foraDeOrdem.tool_use_id, 'toolu_cedo');
  assert.equal(foraDeOrdem.is_error, true);
  assert.match(foraDeOrdem.content, /^falha: Etapa fora de ordem: gerar_curriculo/);
  assert.match(foraDeOrdem.content, /Próximo passo válido: analisar_ats/);
  const [paraCandidato] = eventosDo(primeiro, 'tool_resultado').filter((e) => e.callId === 'toolu_cedo');
  assert.doesNotMatch(paraCandidato.erro.mensagem, NOME_DE_TOOL);
  assert.match(paraCandidato.erro.mensagem, /^Ainda não dá para seguir com a reescrita do currículo/);
  assert.match(paraCandidato.erro.mensagem, /Próximo passo: fazer a análise ATS/);
  const persistida = conversa.mensagens.find((m) => m.dados?.callId === 'toolu_cedo');
  assert.equal(persistida.dados.erro, paraCandidato.erro.mensagem);
  const [confirmacao] = eventosDo(primeiro, 'confirmacao');
  assert.equal(confirmacao.tool, 'gerar_curriculo');
  assert.equal(confirmacao.callId, 'auto_toolu_analise');
  assert.equal(eventosDo(primeiro, 'fim_turno')[0].motivo, 'aguardando_confirmacao');
  assert.equal((await pipelineAts.situacao('usuario-1', 'vaga-1')).estado, 'AGUARDANDO_CONFIRMACAO');

  const segundo = resposta();
  await chat.chat(segundo, usuario, { conversaId: 'conversa-1', confirmacao: { callId: confirmacao.callId, decisao: 'confirmar' } });
  assert.equal(eventosDo(segundo, 'fim_turno')[0].motivo, 'completo');
  assert.equal(ai.payloads.length, 2);
  await aguardar(() => geracoes[0]?.status === 'CONCLUIDA' && anexos.length === 1);

  assert.deepEqual(
    banco.eventos.map((e) => [e.tipo, e.para]),
    [
      ['analise_concluida', 'ANALISADA'],
      ['confirmacao_solicitada', 'AGUARDANDO_CONFIRMACAO'],
      ['geracao_iniciada', 'GERANDO'],
      ['geracao_concluida', 'CONCLUIDA'],
    ],
  );
  assert.equal(banco.eventos[2].dados.origem, 'confirmacao');
  const [, jobId, , mensagens, dados] = anexos[0];
  assert.equal(jobId, geracoes[0].id);
  assert.deepEqual(dados, banco.eventos[3].dados.narracao);
  assert.match(mensagens.etapa1, /^Etapa 1: Aderência do perfil-mestre\nScore: 48/);
  assert.match(mensagens.etapa3, /Score: 71\. Para referência, a aderência do perfil-mestre foi 48\./);
  assert.match(mensagens.etapa3, /Keywords cobertas: Java, Docker/);
  assert.match(mensagens.etapa3, /Observação: Os arquivos PDF e DOCX/);
  assert.ok(!`${mensagens.etapa1}${mensagens.etapa3}`.includes('[['));

  ai.turnos.push(turnoTool('redigir_mensagem_recrutador', {}, 'toolu_msg'));
  const terceiro = resposta();
  await chat.chat(terceiro, usuario, { conversaId: 'conversa-1', mensagem: 'Escreva a mensagem ao recrutador' });
  assert.equal(ai.payloads.at(-1).pipelineAts.estado, 'CONCLUIDA');
  assert.equal(eventosDo(terceiro, 'entrega_externa').length, 1);
  assert.ok(conversa.mensagens.every((m) => !String(m.conteudo).includes('[[NARRACAO')));
});

test('perfil alterado depois da geracao: o agente ve DESATUALIZADA e a geracao volta pela analise', async () => {
  const { pipelineAts, ai, chat, geracoes } = ambiente();
  await pipelineAts.aplicar('usuario-1', 'vaga-1', { tipo: 'geracao_iniciada', jobId: 'job-0', origem: 'direta' });
  await pipelineAts.aplicar('usuario-1', 'vaga-1', { tipo: 'geracao_concluida', jobId: 'job-0', curriculoId: 'cv-0', narracao: null });
  await pipelineAts.perfilAlterado('usuario-1');

  ai.turnos.push(turnoTool('gerar_curriculo', {}, 'toolu_regera'), turnoTool('analisar_ats', {}, 'toolu_a'));
  const res = resposta();
  await chat.chat(res, usuario, { mensagem: 'Mudei meu perfil, gera de novo', oportunidadeId: 'vaga-1' });

  assert.equal(ai.payloads[0].pipelineAts.estado, 'DESATUALIZADA');
  assert.match(ai.payloads[0].pipelineAts.descricao, /perfil mudou/);
  const erro = mensagensEnviadas(ai.payloads[1]).at(-1).content[0];
  assert.equal(erro.is_error, true);
  assert.match(erro.content, /analisar_ats/);
  assert.equal(ai.payloads.length, 2);
  assert.equal(eventosDo(res, 'confirmacao')[0].tool, 'gerar_curriculo');
  assert.equal((await pipelineAts.situacao('usuario-1', 'vaga-1')).estado, 'AGUARDANDO_CONFIRMACAO');
  assert.equal(geracoes.length, 0);
});

test('recusa da confirmacao volta para analisada e falha da geracao vira FALHOU', async () => {
  const { banco, pipelineAts, ai, chat, geracoes } = ambiente({ falharGeracao: true });
  ai.turnos.push(turnoTool('analisar_ats', {}, 'toolu_a'));
  const primeiro = resposta();
  await chat.chat(primeiro, usuario, { mensagem: 'Gere', oportunidadeId: 'vaga-1' });
  const [pedido] = eventosDo(primeiro, 'confirmacao');

  ai.turnos.push(turnoTexto('Tudo bem, fica para depois.'));
  await chat.chat(resposta(), usuario, { conversaId: 'conversa-1', confirmacao: { callId: pedido.callId, decisao: 'recusar' } });
  assert.equal((await pipelineAts.situacao('usuario-1', 'vaga-1')).estado, 'ANALISADA');

  ai.turnos.push(turnoTool('gerar_curriculo', {}, 'toolu_g2'));
  const terceiro = resposta();
  await chat.chat(terceiro, usuario, { conversaId: 'conversa-1', mensagem: 'Agora pode gerar' });
  const [novoPedido] = eventosDo(terceiro, 'confirmacao');
  await chat.chat(resposta(), usuario, { conversaId: 'conversa-1', confirmacao: { callId: novoPedido.callId, decisao: 'confirmar' } });
  await aguardar(() => geracoes[0]?.status === 'ERRO' && banco.eventos.some((e) => e.tipo === 'geracao_falhou'));

  assert.equal((await pipelineAts.situacao('usuario-1', 'vaga-1')).estado, 'FALHOU');
  assert.deepEqual(
    banco.eventos.map((e) => e.tipo),
    ['analise_concluida', 'confirmacao_solicitada', 'confirmacao_recusada', 'confirmacao_solicitada', 'geracao_iniciada', 'geracao_falhou'],
  );
  assert.equal(banco.eventos.at(-1).dados.erro, 'ai-service indisponivel');
});

test('acao externa antes do curriculo concluido volta com o proximo passo valido', async () => {
  const { ai, chat } = ambiente();
  ai.turnos.push(
    turnoTool('definir_proximo_passo', { titulo: 'Enviar candidatura', tipo: 'ENVIAR_CANDIDATURA' }, 'toolu_ext'),
    turnoTexto('Primeiro preciso analisar a vaga.'),
  );
  const res = resposta();
  await chat.chat(res, usuario, { mensagem: 'Agende o envio', oportunidadeId: 'vaga-1' });
  assert.equal(eventosDo(res, 'confirmacao').length, 0);
  const erro = mensagensEnviadas(ai.payloads[1]).at(-1).content[0];
  assert.equal(erro.is_error, true);
  assert.match(erro.content, /currículo gerado e concluído/);
  assert.match(erro.content, /Próximo passo válido: analisar_ats/);
});

test('analise concluida pede a confirmacao da reescrita sem passo do modelo e o historico fecha o par da tool', async () => {
  const { ai, chat, conversa } = ambiente();
  ai.turnos.push(turnoTool('analisar_ats', {}, 'toolu_so_analise'));
  const primeiro = resposta();
  await chat.chat(primeiro, usuario, { mensagem: 'Analise a vaga', oportunidadeId: 'vaga-1' });

  assert.equal(ai.payloads.length, 1);
  assert.equal(ai.turnos.length, 0);
  const chamadas = eventosDo(primeiro, 'tool_call').map((e) => [e.tool, e.exigeConfirmacao]);
  assert.deepEqual(chamadas, [['analisar_ats', false], ['gerar_curriculo', true]]);
  const [pedido] = eventosDo(primeiro, 'confirmacao');
  assert.match(pedido.resumo, /Etapa 1 \(Análise ATS\) concluída/);
  assert.equal(conversa.pendencia.callId, 'auto_toolu_so_analise');

  ai.turnos.push(turnoTexto('Tudo bem.'));
  await chat.chat(resposta(), usuario, { conversaId: 'conversa-1', confirmacao: { callId: pedido.callId, decisao: 'recusar' } });
  const enviadas = mensagensEnviadas(ai.payloads[1]);
  const usos = enviadas.flatMap((m) => m.content).filter((b) => b.type === 'tool_use').map((b) => b.id);
  const resultados = enviadas.flatMap((m) => m.content).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id);
  assert.deepEqual(usos, ['toolu_so_analise', 'auto_toolu_so_analise']);
  assert.deepEqual(resultados, usos);
  assert.ok(enviadas.every((m, i) => i === 0 || m.role !== enviadas[i - 1].role));
});

test('analise que nao muda o estado segue para o modelo sem pedir confirmacao', async () => {
  const { ai, chat, pipelineAts } = ambiente();
  await pipelineAts.aplicar('usuario-1', 'vaga-1', { tipo: 'geracao_iniciada', jobId: 'job-x', origem: 'direta' });
  ai.turnos.push(turnoTool('analisar_ats', {}, 'toolu_durante'), turnoTexto('A geração ainda está em andamento.'));
  const res = resposta();
  await chat.chat(res, usuario, { mensagem: 'Analise de novo', oportunidadeId: 'vaga-1' });
  assert.equal(eventosDo(res, 'confirmacao').length, 0);
  assert.equal(ai.payloads.length, 2);
  assert.equal(eventosDo(res, 'fim_turno')[0].motivo, 'completo');
});

async function desatualizada() {
  const amb = ambiente();
  await amb.pipelineAts.aplicar('usuario-1', 'vaga-1', { tipo: 'geracao_iniciada', jobId: 'job-0', origem: 'direta' });
  await amb.pipelineAts.aplicar('usuario-1', 'vaga-1', { tipo: 'geracao_concluida', jobId: 'job-0', curriculoId: 'cv-0', narracao: null });
  await amb.pipelineAts.perfilAlterado('usuario-1');
  return amb;
}

test('curriculo desatualizado: confirmacao da acao externa avisa e oferece gerar de novo', async () => {
  const { ai, chat, conversa } = await desatualizada();
  ai.turnos.push(turnoTool('registrar_candidatura', { vagaId: 'vaga-1', curriculoId: 'cv-0' }, 'toolu_cand'));
  const res = resposta();
  await chat.chat(res, usuario, { mensagem: 'Registre que me candidatei', oportunidadeId: 'vaga-1' });

  assert.equal(ai.payloads[0].pipelineAts.estado, 'DESATUALIZADA');
  const [pedido] = eventosDo(res, 'confirmacao');
  assert.equal(pedido.tool, 'registrar_candidatura');
  assert.match(pedido.resumo, /^Registrar a candidatura\. O currículo desta vaga é anterior à última mudança do seu perfil/);
  assert.match(pedido.resumo, /gerar o currículo de novo/);
  assert.deepEqual(pedido.aviso, {
    tipo: 'curriculo_desatualizado',
    mensagem: pedido.aviso.mensagem,
    sugestao: 'Gere o currículo de novo com o meu perfil atual',
  });
  assert.equal(conversa.pendencia.resumo, pedido.resumo);
  assert.deepEqual(conversa.pendencia.aviso, pedido.aviso);

  await chat.chat(resposta(), usuario, { conversaId: 'conversa-1', confirmacao: { callId: pedido.callId, decisao: 'confirmar' } }).catch(() => {});
  const resultado = conversa.mensagens.find((m) => m.dados?.callId === 'toolu_cand' && m.papel === 'tool');
  assert.equal(resultado.dados.ok, true);
});

test('curriculo desatualizado: a redacao externa sai com o aviso', async () => {
  const { ai, chat, conversa } = await desatualizada();
  ai.turnos.push(turnoTool('redigir_mensagem_recrutador', {}, 'toolu_red'));
  const res = resposta();
  await chat.chat(res, usuario, { mensagem: 'Escreva ao recrutador', oportunidadeId: 'vaga-1' });
  const [entrega] = eventosDo(res, 'entrega_externa');
  assert.equal(entrega.aviso.tipo, 'curriculo_desatualizado');
  assert.equal(entrega.texto, 'Ola');
  assert.equal(conversa.mensagens.at(-1).dados.entrega.aviso.tipo, 'curriculo_desatualizado');
});

test('curriculo concluido nao recebe aviso e tarefa generica nao exige curriculo', async () => {
  const { ai, chat, pipelineAts } = ambiente();
  ai.turnos.push(turnoTool('definir_proximo_passo', { titulo: 'Estudar Docker', tipo: 'OUTRO' }, 'toolu_outro'));
  const semAnalise = resposta();
  await chat.chat(semAnalise, usuario, { mensagem: 'Me lembre de estudar Docker', oportunidadeId: 'vaga-1' });
  assert.equal((await pipelineAts.situacao('usuario-1', 'vaga-1')).estado, 'SEM_ANALISE');
  const [pedido] = eventosDo(semAnalise, 'confirmacao');
  assert.equal(pedido.tool, 'definir_proximo_passo');
  assert.equal(pedido.aviso, undefined);
  assert.doesNotMatch(pedido.resumo, /anterior à última mudança/);
});
