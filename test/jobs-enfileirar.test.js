const assert = require('node:assert/strict');
const test = require('node:test');
const { JobsService } = require('../dist/jobs/jobs.service');
const { FilaSqs, configuracaoSqs } = require('../dist/jobs/fila');
const { comRequestId } = require('../dist/observabilidade/contexto');
const { SEM_PG, prismaDoBanco, novoUsuario } = require('./helpers/postgres');

function prismaFalso() {
  const jobs = [];
  return {
    jobs,
    job: {
      create: async ({ data }) => {
        const job = { id: `job-${jobs.length + 1}`, status: 'PENDENTE', enfileiradoEm: null, ...data };
        jobs.push(job);
        return job;
      },
      updateMany: async ({ where, data }) => {
        const alvo = jobs.filter((j) => j.id === where.id && j.status === where.status);
        alvo.forEach((j) => Object.assign(j, data));
        return { count: alvo.length };
      },
    },
  };
}

test('mensagem leva so jobId e tipo, e o job guarda o requestId do pedido', async () => {
  const prisma = prismaFalso();
  const enviadas = [];
  const jobs = new JobsService(prisma, { enviar: async (m) => enviadas.push(m) });
  const job = await comRequestId('req-123', () => jobs.criar(prisma, { tipo: 'extrair_keywords', usuarioId: 'u1', referenciaId: 'v1' }));
  assert.equal(job.requestId, 'req-123');
  assert.equal(await jobs.enfileirar([job]), 1);
  assert.deepEqual(enviadas, [{ jobId: job.id, tipo: 'extrair_keywords' }]);
  assert.ok(prisma.jobs[0].enfileiradoEm instanceof Date);
});

test('falha no envio deixa o job pendente sem marca de enfileirado e nao propaga o erro', async () => {
  const prisma = prismaFalso();
  const jobs = new JobsService(prisma, { enviar: async () => { throw new Error('fila fora'); } });
  const job = await jobs.criar(prisma, { tipo: 'gerar_curriculo', usuarioId: 'u1', referenciaId: 'g1' });
  assert.equal(await jobs.enfileirar([job]), 0);
  assert.equal(prisma.jobs[0].status, 'PENDENTE');
  assert.equal(prisma.jobs[0].enfileiradoEm, null);
});

test('adaptador SQS exige a URL da fila e aceita endpoint local', () => {
  assert.throws(() => configuracaoSqs({}), /SQS_FILA_JOBS_URL/);
  assert.deepEqual(configuracaoSqs({ SQS_FILA_JOBS_URL: 'http://elasticmq:9324/000000000000/prdal-jobs', SQS_ENDPOINT: 'http://elasticmq:9324' }), {
    url: 'http://elasticmq:9324/000000000000/prdal-jobs',
    endpoint: 'http://elasticmq:9324',
    regiao: 'us-east-1',
  });
  assert.doesNotThrow(() => new FilaSqs({}));
});

test('job criado dentro de uma transacao desfeita nunca chega a fila', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const usuario = await novoUsuario(prisma);
  const enviadas = [];
  const jobs = new JobsService(prisma, { enviar: async (m) => enviadas.push(m) });
  let criado;
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      criado = await jobs.criar(tx, { tipo: 'extrair_keywords', usuarioId: usuario.id, referenciaId: 'vaga-x' });
      throw new Error('desfaz');
    }),
    /desfaz/,
  );
  assert.equal(await prisma.job.count({ where: { id: criado.id } }), 0);
  assert.equal(enviadas.length, 0);
  const job = await prisma.$transaction((tx) => jobs.criar(tx, { tipo: 'extrair_keywords', usuarioId: usuario.id, referenciaId: 'vaga-y' }));
  await jobs.enfileirar([job]);
  const gravado = await prisma.job.findUnique({ where: { id: job.id } });
  assert.equal(gravado.status, 'PENDENTE');
  assert.ok(gravado.enfileiradoEm);
});
