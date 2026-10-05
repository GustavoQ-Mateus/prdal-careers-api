const assert = require('node:assert/strict');
const test = require('node:test');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');

function prismaFalso() {
  const geracoes = [];
  const prisma = {
    geracoes,
    vaga: {
      findFirst: async () => ({ id: 'vaga-1', usuarioId: 'usuario-1', titulo: 'Dev', empresa: 'Acme', descricao: 'Java', keywordsStatus: 'VALIDAS', keywords: [{ termo: 'Java', peso: 1 }] }),
    },
    perfilMestre: { findUnique: async () => ({ usuarioId: 'usuario-1', nome: 'Pessoa', experiencias: [], formacao: [], certificacoes: [], idiomas: [], skills: [] }) },
    geracaoCurriculo: {
      findFirst: async ({ where }) => {
        const candidatas = geracoes.filter(
          (g) => g.usuarioId === where.usuarioId && g.vagaId === where.vagaId && (!where.status?.in || where.status.in.includes(g.status)),
        );
        return candidatas.at(-1) ?? null;
      },
      create: async ({ data }) => {
        const geracao = { id: `geracao-${geracoes.length + 1}`, status: 'PENDENTE', curriculoId: null, ...data };
        geracoes.push(geracao);
        return geracao;
      },
    },
  };
  prisma.$transaction = async (fn) => {
    prisma.emTransacao = true;
    try {
      return await fn(prisma);
    } finally {
      prisma.emTransacao = false;
    }
  };
  return prisma;
}

function servico(prisma) {
  const transicoes = [];
  const jobs = { criados: [], enfileirados: [] };
  const pipelineAts = { aplicar: async (_u, _v, evento) => transicoes.push(evento) };
  const jobsService = {
    criar: async (tx, job) => {
      assert.equal(tx, prisma);
      assert.equal(prisma.emTransacao, true);
      const criado = { id: `job-${jobs.criados.length + 1}`, ...job };
      jobs.criados.push(criado);
      return criado;
    },
    enfileirar: async (lista) => {
      assert.equal(prisma.emTransacao, false);
      jobs.enfileirados.push(...lista.map((j) => j.id));
      return lista.length;
    },
  };
  const service = new CurriculosService(prisma, null, null, null, pipelineAts, null, null, jobsService);
  return { service, transicoes, jobs };
}

test('gerar cria a geracao e o job na mesma transacao, com perfil e vaga normalizados, e so enfileira depois do commit', async () => {
  const prisma = prismaFalso();
  const { service, transicoes, jobs } = servico(prisma);
  const { jobId } = await service.gerar('usuario-1', 'vaga-1');
  assert.equal(jobId, 'geracao-1');
  assert.deepEqual(transicoes, [{ tipo: 'geracao_iniciada', jobId: 'geracao-1', origem: 'direta' }]);
  assert.equal(jobs.criados.length, 1);
  const job = jobs.criados[0];
  assert.deepEqual([job.tipo, job.usuarioId, job.referenciaId], ['gerar_curriculo', 'usuario-1', 'geracao-1']);
  assert.deepEqual(job.entrada.keywords, [{ termo: 'Java', peso: 1 }]);
  assert.deepEqual(job.entrada.vaga, { titulo: 'Dev', empresa: 'Acme', descricao: 'Java', keywords: [{ termo: 'Java', peso: 1 }] });
  assert.equal(job.entrada.perfilMestre.nome, 'Pessoa');
  assert.deepEqual(jobs.enfileirados, ['job-1']);
});

test('gerar sem linha ATS nao interpreta a geracao recem-criada como anterior', async () => {
  const prisma = prismaFalso();
  prisma.pipelineAts = { findUnique: async () => null, create: async () => {} };
  prisma.eventoPipelineAts = { create: async () => {} };
  prisma.geracaoCurriculo.findFirst = async ({ where }) => prisma.geracoes.filter(
    (g) => g.usuarioId === where.usuarioId && g.vagaId === where.vagaId && g.id !== where.id?.not && (!where.status?.in || where.status.in.includes(g.status)),
  ).at(-1) ?? null;
  const { PipelineAtsService } = require('../dist/pipeline-ats/pipeline-ats.service');
  const { service } = servico(prisma);
  service.pipelineAts = new PipelineAtsService(prisma);
  await assert.doesNotReject(service.gerar('usuario-1', 'vaga-1'));
});

test('geracao concluida ou com erro nunca bloqueia uma nova geracao para a mesma vaga', async () => {
  const prisma = prismaFalso();
  const { service, jobs } = servico(prisma);
  const primeira = await service.gerar('usuario-1', 'vaga-1');
  prisma.geracoes[0].status = 'CONCLUIDA';
  const segunda = await service.gerar('usuario-1', 'vaga-1');
  prisma.geracoes[1].status = 'ERRO';
  const terceira = await service.gerar('usuario-1', 'vaga-1');
  assert.deepEqual([primeira.jobId, segunda.jobId, terceira.jobId], ['geracao-1', 'geracao-2', 'geracao-3']);
  assert.equal(jobs.criados.length, 3);
});

test('pedido durante geracao em andamento devolve a mesma geracao sem criar job', async () => {
  const prisma = prismaFalso();
  const { service, transicoes, jobs } = servico(prisma);
  const primeira = await service.gerar('usuario-1', 'vaga-1');
  prisma.geracoes[0].status = 'GERANDO';
  const segunda = await service.gerar('usuario-1', 'vaga-1');
  assert.equal(segunda.jobId, primeira.jobId);
  assert.equal(segunda.status, 'GERANDO');
  assert.equal(prisma.geracoes.length, 1);
  assert.equal(transicoes.length, 1);
  assert.equal(jobs.criados.length, 1);
});

test('a api nao processa nem relanca job: servicos sem onModuleInit e sem processar', () => {
  const { LotesService } = require('../dist/lotes/lotes.service');
  for (const Classe of [CurriculosService, LotesService]) {
    assert.equal(typeof Classe.prototype.onModuleInit, 'undefined', Classe.name);
    assert.equal(typeof Classe.prototype.processar, 'undefined', Classe.name);
  }
  assert.equal(typeof CurriculosService.prototype.reidratarConcluidas, 'undefined');
});
