require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { HttpService } = require('@nestjs/axios');
const { mensagensEnviadas, turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');
const { ArgumentosInvalidos, ToolExecutor } = require('../dist/copiloto/tool-executor');
const { TOOLS_POR_NOME } = require('../dist/copiloto/tools');

function executorComServicos() {
  const chamadas = [];
  const servico = (nome, retorno = {}) =>
    new Proxy({}, {
      get: (_alvo, metodo) => async (...args) => {
        chamadas.push([`${nome}.${String(metodo)}`, ...args]);
        return typeof retorno === 'function' ? retorno(String(metodo)) : retorno;
      },
    });
  const cotas = [];
  const executor = new ToolExecutor(
    servico('oportunidades', (metodo) => (metodo === 'listar' ? { itens: [{ id: 'v1' }], total: 1 } : { id: 'v1' })),
    servico('acoes', { id: 'acao-1' }),
    servico('curriculos', { jobId: 'job-1', status: 'GERANDO' }),
    servico('perfil', { nome: 'Pessoa' }),
    servico('hoje', { itens: [] }),
    servico('candidaturas'),
    servico('capacidades'),
    { verificar: async (usuarioId) => cotas.push(usuarioId) },
  );
  return { executor, chamadas, cotas };
}

test('executa a tool chamando o service com o usuario, sem HTTP', async () => {
  const { executor, chamadas } = executorComServicos();
  const tool = TOOLS_POR_NOME.get('definir_proximo_passo');
  const resultado = await executor.executar('usuario-1', tool, {
    oportunidadeId: 'v1',
    titulo: 'Enviar follow-up',
    tipo: 'FAZER_FOLLOW_UP',
    venceEm: '2026-10-10T12:00:00.000Z',
  });
  assert.deepEqual(resultado, { id: 'acao-1' });
  assert.deepEqual(chamadas, [[
    'acoes.criar',
    'usuario-1',
    'v1',
    { titulo: 'Enviar follow-up', tipo: 'FAZER_FOLLOW_UP', venceEm: '2026-10-10T12:00:00.000Z', lembrarEm: undefined, principal: undefined },
  ]]);
});

test('listagens paginadas chegam como lista e a agenda garante a preferencia antes', async () => {
  const { executor, chamadas } = executorComServicos();
  assert.deepEqual(await executor.executar('u', TOOLS_POR_NOME.get('listar_oportunidades'), { visao: 'ativas' }), [{ id: 'v1' }]);
  await executor.executar('u', TOOLS_POR_NOME.get('ler_agenda'), { periodo: '7' });
  assert.deepEqual(chamadas.slice(1).map((c) => c[0]), ['hoje.garantirPreferencia', 'hoje.agenda']);
});

test('tools do banco de vagas operam sobre a oportunidade em entrada', async () => {
  const { executor, chamadas } = executorComServicos();
  assert.deepEqual(await executor.executar('u', TOOLS_POR_NOME.get('listar_banco_vagas'), {}), [{ id: 'v1' }]);
  await executor.executar('u', TOOLS_POR_NOME.get('ativar_banco_vaga'), { bancoVagaId: 'e1' });
  assert.deepEqual(chamadas, [['oportunidades.listar', 'u', { visao: 'entrada' }], ['oportunidades.ativarEntrada', 'u', 'e1']]);
});

test('args fora do DTO nao chegam ao service', async () => {
  const { executor, chamadas } = executorComServicos();
  const tool = TOOLS_POR_NOME.get('definir_proximo_passo');
  await assert.rejects(
    executor.executar('u', tool, { titulo: 'x', tipo: 'verificar status' }),
    (err) => err instanceof ArgumentosInvalidos && /tipo: deve ser um destes valores/.test(err.message),
  );
  await assert.rejects(executor.executar('u', TOOLS_POR_NOME.get('ler_timeline'), { limite: 500 }), /limite/);
  await assert.rejects(executor.executar('u', TOOLS_POR_NOME.get('ler_perfil'), { extra: 1 }), /extra: campo que esta ação não aceita/);
  assert.equal(chamadas.length, 0);
});

test('tools que chamam o Claude verificam a cota antes, as demais nao', async () => {
  const { executor, cotas } = executorComServicos();
  await executor.executar('u1', TOOLS_POR_NOME.get('gerar_curriculo'), { oportunidadeId: 'v1' });
  await executor.executar('u1', TOOLS_POR_NOME.get('buscar_oportunidade'), { oportunidadeId: 'v1' });
  assert.deepEqual(cotas, ['u1']);
});

test('ChatService nao depende de HttpService nem de credencial do usuario', () => {
  const dependencias = Reflect.getMetadata('design:paramtypes', ChatService);
  assert.ok(!dependencias.includes(HttpService));
  assert.ok(dependencias.includes(ToolExecutor));
  assert.equal(ChatService.prototype.chat.length, 3);
});

test('argumento invalido do modelo vira tool_result com is_error e nao pede confirmacao', async () => {
  const conversa = { id: 'c1', usuarioId: 'u1', modo: 'assistido', oportunidadeId: 'v1', mensagens: [], pendencia: null };
  const conversas = { abrir: async () => conversa, anexar: async () => {}, definirPendencia: async () => { throw new Error('sem pendencia'); } };
  const enviados = [];
  const turnos = [turnoTool('mover_estagio', { destino: 'CONTRATADO' }, 'toolu_x'), turnoTexto('Vou corrigir.')];
  const ai = { copilotoTurnStream: async (payload) => { enviados.push(structuredClone(payload)); return turnos.shift(); } };
  const eventos = [];
  const res = { setHeader() {}, flushHeaders() {}, on() {}, write: (e) => eventos.push(e), end() {} };

  await new ChatService(conversas, ai, { executar: () => { throw new Error('nao executa'); } }).chat(res, { userId: 'u1' }, { mensagem: 'mova a vaga' });

  assert.doesNotMatch(eventos.join(''), /event: confirmacao/);
  const resultado = mensagensEnviadas(enviados[1]).at(-1).content[0];
  assert.equal(resultado.tool_use_id, 'toolu_x');
  assert.equal(resultado.is_error, true);
  assert.match(resultado.content, /destino: deve ser um destes valores/);
});

test('mensagens de validacao saem em portugues para o modelo e para o web', async () => {
  const { executor } = executorComServicos();
  const casos = [
    ['ler_timeline', { limite: 500 }, /limite: não pode ser maior que 100/],
    ['ler_timeline', { limite: 'x' }, /limite: deve ser um número inteiro/],
    ['registrar_nota', { descricao: 7 }, /descricao: deve ser texto/],
    ['definir_proximo_passo', { titulo: 'x', tipo: 'outro', principal: 'sim' }, /principal: deve ser verdadeiro ou falso/],
  ];
  for (const [nome, args, esperado] of casos) {
    await assert.rejects(executor.executar('u', TOOLS_POR_NOME.get(nome), args), (err) => {
      assert.match(err.message, /^argumentos inválidos para /);
      assert.match(err.message, esperado);
      assert.doesNotMatch(err.message, /must|should|shorter|longer|greater|less than/);
      return true;
    });
  }
});
