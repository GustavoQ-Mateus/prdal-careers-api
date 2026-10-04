const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ESTADOS_ATS,
  SITUACAO_INICIAL,
  mensagemForaDeOrdem,
  situacaoDeLegado,
  transicionar,
  verificarOrdem,
} = require('../dist/pipeline-ats/maquina');
const { dadosDaNarracao, narrar } = require('../dist/pipeline-ats/narracao');
const { TransicaoRecusada } = require('../dist/pipeline-ats/pipeline-ats.service');
const { pipelineMemoria } = require('./helpers/pipeline-memoria');

const analise = {
  score: 48,
  keywordsEncontradas: ['TypeScript'],
  keywordsCriticasAusentes: ['Docker'],
  pontosEliminatorios: [],
  veredicto: 'Cobertura baixa.',
};

function aplicar(situacao, ...eventos) {
  return eventos.reduce((atual, evento) => {
    const transicao = transicionar(atual, evento);
    assert.ok(transicao.aceita, `${evento.tipo} recusado em ${atual.estado}`);
    return transicao.situacao;
  }, situacao);
}

const narracao = dadosDaNarracao(analise, { ...analise, score: 76, keywordsEncontradas: ['TypeScript', 'Docker'], keywordsCriticasAusentes: [] }, null);

test('sequencia inteira: analise, confirmacao, geracao e conclusao', () => {
  const caminho = [];
  let situacao = SITUACAO_INICIAL;
  for (const evento of [
    { tipo: 'analise_concluida', analise },
    { tipo: 'confirmacao_solicitada' },
    { tipo: 'geracao_iniciada', jobId: 'job-1', origem: 'confirmacao' },
    { tipo: 'geracao_concluida', jobId: 'job-1', curriculoId: 'cv-1', narracao },
  ]) {
    situacao = aplicar(situacao, evento);
    caminho.push(situacao.estado);
  }
  assert.deepEqual(caminho, ['ANALISADA', 'AGUARDANDO_CONFIRMACAO', 'GERANDO', 'CONCLUIDA']);
  assert.equal(situacao.curriculoId, 'cv-1');
  assert.equal(situacao.jobId, 'job-1');
});

test('caminhos de falha: recusa volta para analisada e erro da geracao vira falhou', () => {
  const aguardando = aplicar(SITUACAO_INICIAL, { tipo: 'analise_concluida', analise }, { tipo: 'confirmacao_solicitada' });
  assert.equal(aplicar(aguardando, { tipo: 'confirmacao_recusada' }).estado, 'ANALISADA');

  const gerando = aplicar(aguardando, { tipo: 'geracao_iniciada', jobId: 'job-1', origem: 'confirmacao' });
  const falhou = aplicar(gerando, { tipo: 'geracao_falhou', jobId: 'job-1', erro: 'ai-service fora' });
  assert.equal(falhou.estado, 'FALHOU');
  assert.equal(transicionar(falhou, { tipo: 'confirmacao_solicitada' }).aceita, false);
  assert.equal(aplicar(falhou, { tipo: 'analise_concluida', analise }).estado, 'ANALISADA');

  const outroJob = transicionar(gerando, { tipo: 'geracao_concluida', jobId: 'job-velho', curriculoId: 'cv', narracao });
  assert.equal(outroJob.aceita, false);
});

test('geracao pelo copiloto so comeca com confirmacao pendente; a direta do web nao exige', () => {
  const analisada = aplicar(SITUACAO_INICIAL, { tipo: 'analise_concluida', analise });
  const semConfirmacao = transicionar(analisada, { tipo: 'geracao_iniciada', jobId: 'j', origem: 'confirmacao' });
  assert.equal(semConfirmacao.aceita, false);
  assert.match(semConfirmacao.proximoPasso, /gerar_curriculo/);
  assert.equal(transicionar(SITUACAO_INICIAL, { tipo: 'geracao_iniciada', jobId: 'j', origem: 'direta' }).situacao.estado, 'GERANDO');
  const gerando = aplicar(SITUACAO_INICIAL, { tipo: 'geracao_iniciada', jobId: 'j', origem: 'direta' });
  assert.equal(transicionar(gerando, { tipo: 'geracao_iniciada', jobId: 'k', origem: 'direta' }).aceita, false);
  assert.equal(transicionar(gerando, { tipo: 'analise_concluida', analise }).aceita, false);
});

test('tool fora de ordem diz qual e o proximo passo valido', () => {
  const casos = [
    ['gerar_curriculo', {}, SITUACAO_INICIAL, /analisar_ats/],
    ['redigir_mensagem_recrutador', {}, aplicar(SITUACAO_INICIAL, { tipo: 'analise_concluida', analise }), /gerar_curriculo/],
    ['definir_proximo_passo', { tipo: 'ENVIAR_CANDIDATURA' }, SITUACAO_INICIAL, /analisar_ats/],
    ['analisar_ats', {}, aplicar(SITUACAO_INICIAL, { tipo: 'geracao_iniciada', jobId: 'j', origem: 'direta' }), /status_geracao/],
  ];
  for (const [tool, args, situacao, passo] of casos) {
    const fora = verificarOrdem(tool, args, situacao);
    assert.ok(fora, tool);
    const mensagem = mensagemForaDeOrdem(tool, situacao, fora);
    assert.match(mensagem, /^Etapa fora de ordem: /);
    assert.match(mensagem, passo);
    assert.ok(!mensagem.includes('\u2014'));
  }
  assert.equal(verificarOrdem('definir_proximo_passo', { tipo: 'REVISAR_VAGA' }, SITUACAO_INICIAL), null);
  assert.equal(verificarOrdem('ler_perfil', {}, SITUACAO_INICIAL), null);
  const concluida = situacaoDeLegado({ id: 'j', status: 'CONCLUIDA', curriculoId: 'cv' });
  assert.equal(verificarOrdem('registrar_candidatura', {}, concluida), null);
});

test('perfil alterado depois da geracao deixa o curriculo desatualizado', () => {
  const concluida = situacaoDeLegado({ id: 'job-1', status: 'CONCLUIDA', curriculoId: 'cv-1' });
  const desatualizada = aplicar(concluida, { tipo: 'perfil_alterado' });
  assert.equal(desatualizada.estado, 'DESATUALIZADA');
  assert.equal(verificarOrdem('gerar_curriculo', {}, desatualizada).proximoPasso.startsWith('analisar_ats'), true);
  assert.equal(verificarOrdem('redigir_mensagem_recrutador', {}, desatualizada), null);
  assert.equal(aplicar(desatualizada, { tipo: 'analise_concluida', analise }).estado, 'ANALISADA');

  const analisada = aplicar(SITUACAO_INICIAL, { tipo: 'analise_concluida', analise }, { tipo: 'confirmacao_solicitada' });
  assert.equal(aplicar(analisada, { tipo: 'perfil_alterado' }).estado, 'SEM_ANALISE');

  const gerando = aplicar(SITUACAO_INICIAL, { tipo: 'geracao_iniciada', jobId: 'j', origem: 'direta' });
  const marcada = aplicar(gerando, { tipo: 'perfil_alterado' });
  assert.equal(marcada.estado, 'GERANDO');
  assert.equal(aplicar(marcada, { tipo: 'geracao_concluida', jobId: 'j', curriculoId: 'cv', narracao }).estado, 'DESATUALIZADA');

  const semEfeito = transicionar(SITUACAO_INICIAL, { tipo: 'perfil_alterado' });
  assert.equal(semEfeito.registrar, false);
});

test('toda combinacao de estado e evento devolve aceite ou recusa com proximo passo', () => {
  const eventos = [
    { tipo: 'analise_concluida', analise },
    { tipo: 'confirmacao_solicitada' },
    { tipo: 'confirmacao_recusada' },
    { tipo: 'geracao_iniciada', jobId: 'j', origem: 'confirmacao' },
    { tipo: 'geracao_iniciada', jobId: 'j', origem: 'direta' },
    { tipo: 'geracao_concluida', jobId: 'j', curriculoId: 'cv', narracao },
    { tipo: 'geracao_falhou', jobId: 'j', erro: 'x' },
    { tipo: 'perfil_alterado' },
  ];
  for (const estado of ESTADOS_ATS) {
    for (const evento of eventos) {
      const transicao = transicionar({ ...SITUACAO_INICIAL, estado, jobId: 'j' }, evento);
      if (transicao.aceita) assert.ok(ESTADOS_ATS.includes(transicao.situacao.estado));
      else assert.ok(transicao.proximoPasso.length > 0);
    }
  }
});

test('legado sem linha de pipeline vem da ultima geracao', () => {
  assert.equal(situacaoDeLegado(null).estado, 'SEM_ANALISE');
  assert.equal(situacaoDeLegado({ id: 'j', status: 'GERANDO', curriculoId: null }).estado, 'GERANDO');
  assert.equal(situacaoDeLegado({ id: 'j', status: 'ERRO', curriculoId: null }).estado, 'FALHOU');
});

test('narracao e montada dos dados do evento em duas mensagens, sem marcador nem travessao', () => {
  const dados = dadosDaNarracao(
    { ...analise, pontosEliminatorios: ['secao obrigatoria ausente'] },
    { ...analise, score: 76, keywordsEncontradas: ['TypeScript'], keywordsCriticasAusentes: ['Docker'] },
    'Curriculo mantido com 2 paginas',
  );
  const { etapa1, etapa3 } = narrar(dados);
  assert.match(etapa1, /^Etapa 1: Aderência do perfil-mestre\nScore: 48\n/);
  assert.match(etapa1, /Keywords críticas ausentes: Docker/);
  assert.match(etapa1, /Pontos de atenção: secao obrigatoria ausente/);
  assert.match(etapa3, /^Etapa 3: Aderência do currículo gerado/);
  assert.match(etapa3, /Score: 76\. Para referência, a aderência do perfil-mestre foi 48\./);
  assert.match(etapa3, /Keywords cobertas: TypeScript/);
  assert.match(etapa3, /Keywords ainda ausentes: Docker/);
  assert.match(etapa3, /Observação: Curriculo mantido com 2 paginas/);
  for (const texto of [etapa1, etapa3]) {
    for (const proibido of ['[[', ']]', '\u2014', 'aumentou', 'melhorou', 'reduziu']) {
      assert.ok(!texto.includes(proibido), proibido);
    }
  }
  assert.equal(dadosDaNarracao({ score: 'x' }, analise, null), null);
});

test('servico grava um evento estruturado por transicao e recusa fora de ordem', async () => {
  const { banco, service } = pipelineMemoria();
  await service.aplicar('u1', 'v1', { tipo: 'analise_concluida', analise });
  await service.aplicar('u1', 'v1', { tipo: 'confirmacao_solicitada' });
  await service.aplicar('u1', 'v1', { tipo: 'geracao_iniciada', jobId: 'job-1', origem: 'confirmacao' });
  await service.aplicar('u1', 'v1', { tipo: 'geracao_concluida', jobId: 'job-1', curriculoId: 'cv-1', narracao });

  assert.deepEqual(
    banco.eventos.map((e) => [e.tipo, e.de, e.para]),
    [
      ['analise_concluida', 'SEM_ANALISE', 'ANALISADA'],
      ['confirmacao_solicitada', 'ANALISADA', 'AGUARDANDO_CONFIRMACAO'],
      ['geracao_iniciada', 'AGUARDANDO_CONFIRMACAO', 'GERANDO'],
      ['geracao_concluida', 'GERANDO', 'CONCLUIDA'],
    ],
  );
  assert.deepEqual(banco.eventos[0].dados.analise, analise);
  assert.equal(banco.eventos[3].jobId, 'job-1');
  assert.deepEqual(await service.narracaoDaGeracao('u1', 'job-1'), narracao);
  assert.equal(banco.linhas.get('v1').versao, 4);

  await assert.rejects(service.aplicar('u1', 'v1', { tipo: 'confirmacao_solicitada' }), (err) => {
    assert.ok(err instanceof TransicaoRecusada);
    assert.equal(err.getStatus(), 409);
    assert.match(err.message, /Próximo passo válido: buscar_curriculo/);
    return true;
  });
  assert.equal(banco.eventos.length, 4);
});

test('servico materializa o legado e marca desatualizada ao salvar o perfil', async () => {
  const { banco, service } = pipelineMemoria({
    geracoes: [{ id: 'job-velho', usuarioId: 'u1', vagaId: 'v-legado', status: 'CONCLUIDA', curriculoId: 'cv-velho' }],
  });
  await service.aplicar('u1', 'v-nova', { tipo: 'analise_concluida', analise });
  assert.equal((await service.situacao('u1', 'v-legado')).estado, 'CONCLUIDA');

  await service.perfilAlterado('u1');

  assert.equal((await service.situacao('u1', 'v-legado')).estado, 'DESATUALIZADA');
  assert.equal((await service.situacao('u1', 'v-nova')).estado, 'SEM_ANALISE');
  assert.deepEqual(
    banco.eventos.filter((e) => e.tipo === 'perfil_alterado').map((e) => [e.vagaId, e.de, e.para]).sort(),
    [['v-legado', 'CONCLUIDA', 'DESATUALIZADA'], ['v-nova', 'ANALISADA', 'SEM_ANALISE']],
  );
  assert.match(await service.ordem('u1', 'v-legado', 'gerar_curriculo', {}), /analisar_ats/);
});

test('servico repete a transicao quando a versao muda no meio', async () => {
  const { banco, service } = pipelineMemoria();
  await service.aplicar('u1', 'v1', { tipo: 'analise_concluida', analise });
  const original = banco.pipelineAts.updateMany;
  let interferiu = false;
  banco.pipelineAts.updateMany = async (args) => {
    if (!interferiu) {
      interferiu = true;
      banco.linhas.get('v1').versao += 1;
    }
    return original(args);
  };
  const situacao = await service.aplicar('u1', 'v1', { tipo: 'confirmacao_solicitada' });
  assert.equal(situacao.estado, 'AGUARDANDO_CONFIRMACAO');
  assert.equal(banco.eventos.filter((e) => e.tipo === 'confirmacao_solicitada').length, 1);
});
