const { PipelineAtsService } = require('../../dist/pipeline-ats/pipeline-ats.service');

function bancoPipeline({ geracoes = [] } = {}) {
  const linhas = new Map();
  const eventos = [];
  const banco = {
    linhas,
    eventos,
    geracoes,
    pipelineAts: {
      findUnique: async ({ where }) => (linhas.has(where.vagaId) ? { ...linhas.get(where.vagaId) } : null),
      create: async ({ data }) => {
        if (linhas.has(data.vagaId)) throw new Error('linha duplicada');
        linhas.set(data.vagaId, { ...data });
        return { ...data };
      },
      updateMany: async ({ where, data }) => {
        const linha = linhas.get(where.vagaId);
        if (!linha || linha.versao !== where.versao) return { count: 0 };
        Object.assign(linha, data);
        return { count: 1 };
      },
      findMany: async ({ where }) =>
        [...linhas.values()]
          .filter((linha) => linha.usuarioId === where.usuarioId && where.estado.in.includes(linha.estado))
          .map((linha) => ({ vagaId: linha.vagaId })),
    },
    eventoPipelineAts: {
      create: async ({ data }) => {
        const evento = { id: `evento-${eventos.length + 1}`, ocorridoEm: new Date(), ...data };
        eventos.push(evento);
        return evento;
      },
      findFirst: async ({ where }) =>
        [...eventos].reverse().find(
          (evento) => evento.usuarioId === where.usuarioId && evento.jobId === where.jobId && evento.tipo === where.tipo,
        ) ?? null,
      findMany: async ({ where }) =>
        eventos.filter((evento) => evento.usuarioId === where.usuarioId && evento.vagaId === where.vagaId),
    },
    geracaoCurriculo: {
      findFirst: async ({ where }) =>
        [...geracoes].reverse().find((g) => g.usuarioId === where.usuarioId && g.vagaId === where.vagaId) ?? null,
    },
    vaga: {
      findMany: async ({ where }) => {
        const ids = new Set(
          geracoes.filter((g) => g.usuarioId === where.usuarioId && !linhas.has(g.vagaId)).map((g) => g.vagaId),
        );
        return [...ids].map((id) => ({ id }));
      },
    },
    $transaction: async (fn) => fn(banco),
  };
  return banco;
}

function pipelineMemoria(opcoes) {
  const banco = bancoPipeline(opcoes);
  return { banco, service: new PipelineAtsService(banco) };
}

module.exports = { bancoPipeline, pipelineMemoria };
