require('./helpers/armazenamento');
const assert = require('node:assert/strict');
const test = require('node:test');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');

function prismaFalso() {
  const geracoes = [];
  const prisma = {
    geracoes,
    vaga: {
      findFirst: async () => ({ id: 'vaga-1', usuarioId: 'usuario-1', keywordsStatus: 'VALIDAS', keywords: [{ termo: 'Java', peso: 1 }] }),
    },
    perfilMestre: { findUnique: async () => ({ usuarioId: 'usuario-1' }) },
    geracaoCurriculo: {
      findFirst: async ({ where }) => {
        const candidatas = geracoes.filter(
          (g) => g.usuarioId === where.usuarioId && g.vagaId === where.vagaId && (!where.status?.in || where.status.in.includes(g.status)),
        );
        return candidatas.at(-1) ?? null;
      },
      create: async ({ data }) => {
        const geracao = { id: `job-${geracoes.length + 1}`, status: 'PENDENTE', curriculoId: null, ...data };
        geracoes.push(geracao);
        return geracao;
      },
    },
  };
  prisma.$transaction = async (fn) => fn(prisma);
  return prisma;
}

function servico(prisma, aoProcessar) {
  const pipelineAts = { aplicar: async (_u, _v, evento) => prisma.transicoes.push(evento) };
  prisma.transicoes = [];
  const service = new CurriculosService(prisma, null, null, null, null, pipelineAts);
  service.processar = async (id) => aoProcessar(prisma.geracoes.find((g) => g.id === id));
  return service;
}

test('geracao concluida nao bloqueia uma nova geracao para a mesma vaga', async () => {
  const prisma = prismaFalso();
  const service = servico(prisma, (geracao) => {
    geracao.status = 'CONCLUIDA';
    geracao.curriculoId = `cv-${geracao.id}`;
  });

  const primeira = await service.gerar('usuario-1', 'vaga-1');
  await new Promise((resolve) => setImmediate(resolve));
  const segunda = await service.gerar('usuario-1', 'vaga-1');

  assert.notEqual(primeira.jobId, segunda.jobId);
  assert.equal(prisma.geracoes.length, 2);
  assert.deepEqual(prisma.transicoes.map((e) => [e.tipo, e.origem]), [['geracao_iniciada', 'direta'], ['geracao_iniciada', 'direta']]);
});

test('geracao com erro gera um job novo em vez de reiniciar o antigo', async () => {
  const prisma = prismaFalso();
  const service = servico(prisma, (geracao) => {
    geracao.status = 'ERRO';
  });

  const primeira = await service.gerar('usuario-1', 'vaga-1');
  await new Promise((resolve) => setImmediate(resolve));
  const segunda = await service.gerar('usuario-1', 'vaga-1');

  assert.notEqual(primeira.jobId, segunda.jobId);
  assert.equal(prisma.geracoes[0].status, 'ERRO');
});

test('solicitacao durante geracao em andamento devolve o job em andamento', async () => {
  const prisma = prismaFalso();
  const service = servico(prisma, (geracao) => {
    geracao.status = 'GERANDO';
  });

  const primeira = await service.gerar('usuario-1', 'vaga-1');
  await new Promise((resolve) => setImmediate(resolve));
  const segunda = await service.gerar('usuario-1', 'vaga-1');

  assert.equal(segunda.jobId, primeira.jobId);
  assert.equal(segunda.status, 'GERANDO');
  assert.equal(prisma.geracoes.length, 1);
  assert.equal(prisma.transicoes.length, 1);
});
