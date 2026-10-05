const assert = require('node:assert/strict');
const test = require('node:test');
const { OportunidadesService } = require('../dist/oportunidades/oportunidades.service');
const { LotesService, tipoDoJob } = require('../dist/lotes/lotes.service');

function filaFalsa(banco) {
  const jobs = { criados: [], enfileirados: [] };
  return {
    jobs,
    servico: {
      criar: async (tx, job) => {
        assert.equal(banco.emTransacao, true, 'job criado fora da transacao');
        const criado = { id: `job-${jobs.criados.length + 1}`, ...job };
        jobs.criados.push(criado);
        return criado;
      },
      enfileirar: async (lista) => {
        assert.equal(banco.emTransacao, false, 'enfileirado antes do commit');
        jobs.enfileirados.push(...lista.map((j) => j.id));
        return lista.length;
      },
    },
  };
}

function bancoDeVagas(existente) {
  const banco = {
    emTransacao: false,
    criadas: [],
    atualizacoes: [],
    vaga: {
      findMany: async () => [],
      findFirst: async () => existente ?? null,
      create: async ({ data }) => {
        const vaga = { id: `vaga-${banco.criadas.length + 1}`, ...data };
        banco.criadas.push(vaga);
        return vaga;
      },
      update: async ({ data }) => {
        banco.atualizacoes.push(data);
        return { ...existente, ...data };
      },
    },
  };
  banco.$transaction = async (fn) => {
    banco.emTransacao = true;
    try {
      return await fn(banco);
    } finally {
      banco.emTransacao = false;
    }
  };
  return banco;
}

const semIa = {
  keywords: async () => { throw new Error('a api nao pode chamar o Claude na criacao'); },
  classify: async () => ({ categoria: 'backend', nivel: 'pleno' }),
};
const eventos = { registrar: async () => {} };

test('criar oportunidade responde sem chamar o Claude, com extracao pendente e um job na fila', async () => {
  const banco = bancoDeVagas();
  const { jobs, servico } = filaFalsa(banco);
  const service = new OportunidadesService(banco, semIa, eventos, servico, null);
  const vaga = await service.criar('u1', { titulo: 'Dev', empresa: 'Acme', descricao: 'Java e Docker' });
  assert.deepEqual([vaga.keywordsStatus, vaga.keywordsExtracao, vaga.keywords], ['PENDENTE', 'PENDENTE', []]);
  assert.deepEqual([vaga.categoria, vaga.nivel], ['backend', 'pleno']);
  assert.deepEqual(jobs.criados.map((j) => [j.tipo, j.usuarioId, j.referenciaId]), [['extrair_keywords', 'u1', 'vaga-1']]);
  assert.deepEqual(jobs.enfileirados, ['job-1']);
});

test('editar a descricao reabre a extracao por job; editar outro campo nao', async () => {
  const atual = { id: 'v1', usuarioId: 'u1', titulo: 'Dev', empresa: 'Acme', descricao: 'Java', prioridade: 'MEDIA', arquivadaEm: null };
  const banco = bancoDeVagas(atual);
  const { jobs, servico } = filaFalsa(banco);
  const service = new OportunidadesService(banco, semIa, eventos, servico, null);
  service.garantirVaga = async () => atual;
  await service.atualizar('u1', 'v1', { descricao: 'Java e Kotlin' });
  assert.deepEqual(
    [banco.atualizacoes[0].keywordsStatus, banco.atualizacoes[0].keywordsExtracao, banco.atualizacoes[0].keywordsErro],
    ['PENDENTE', 'PENDENTE', null],
  );
  assert.equal(jobs.criados.length, 1);
  await service.atualizar('u1', 'v1', { prioridade: 'ALTA' });
  await service.atualizar('u1', 'v1', { descricao: 'Java' });
  assert.equal(banco.atualizacoes[1].keywordsExtracao, undefined);
  assert.equal(banco.atualizacoes[2].keywordsExtracao, undefined);
  assert.equal(jobs.criados.length, 1);
});

test('o detalhe da oportunidade mostra o estado e o erro da extracao', async () => {
  const service = new OportunidadesService(null, semIa, eventos, null, null);
  const resumo = service.resumo({
    id: 'v1', titulo: 'Dev', empresa: 'Acme', categoria: null, nivel: null, prioridade: 'MEDIA', arquivadaEm: null, atualizadoEm: new Date(),
    origem: 'MANUAL', keywords: [], keywordsStatus: 'PENDENTE', keywordsExtracao: 'ERRO', keywordsErro: 'ai-service respondeu 503',
    candidaturas: [], curriculos: [], acoes: [], eventos: [],
  });
  assert.deepEqual([resumo.keywordsExtracao, resumo.keywordsErro], ['ERRO', 'ai-service respondeu 503']);
});

test('lote vira um job por item em leque, criado na transacao e enfileirado depois do commit', async () => {
  const banco = {
    emTransacao: false,
    lote: {
      create: async ({ data }) => ({ id: 'l1', ...data, itens: data.itens.create.map((_, i) => ({ id: `item-${i + 1}` })) }),
      update: async () => {},
    },
  };
  banco.$transaction = async (fn) => {
    banco.emTransacao = true;
    try {
      return await fn(banco);
    } finally {
      banco.emTransacao = false;
    }
  };
  const { jobs, servico } = filaFalsa(banco);
  const lote = await new LotesService(banco, servico).criar('u1', 'IMPORTACAO', ['b1', 'b2', 'b3']);
  assert.equal(lote.id, 'l1');
  assert.equal('itens' in lote, false);
  assert.deepEqual(jobs.criados.map((j) => [j.tipo, j.referenciaId]), [['importar_lote', 'item-1'], ['importar_lote', 'item-2'], ['importar_lote', 'item-3']]);
  assert.deepEqual(jobs.enfileirados, ['job-1', 'job-2', 'job-3']);
  assert.equal(tipoDoJob('INGESTAO'), 'reindexar_contexto');
});
