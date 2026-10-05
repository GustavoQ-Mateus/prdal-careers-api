const { ArmazenamentoMemoria } = require('./helpers/armazenamento');
const assert = require('node:assert/strict');
const test = require('node:test');
const { ServiceUnavailableException } = require('@nestjs/common');
const { CurriculosService, DEGRADACAO_RENDERIZACAO } = require('../dist/curriculos/curriculos.service');

function docClientFalhando() {
  const falhar = async () => { throw new Error('connect ECONNREFUSED doc-service'); };
  return { renderPdf: falhar, renderDocx: falhar };
}

test('gerar arquivos novamente mantem a degradacao e responde 503 quando o doc-service segue fora', async () => {
  const atualizacoes = [];
  const prisma = {
    curriculo: {
      findFirst: async () => ({ id: 'cv-1', markdown: '# Pessoa', degradacao: DEGRADACAO_RENDERIZACAO }),
      update: async ({ data }) => { atualizacoes.push(data); },
    },
  };
  prisma.$transaction = async (fn) => fn(prisma);
  const jobs = { criar: async (_tx, job) => ({ id: 'job-1', ...job }), enfileirar: async () => 1 };
  const service = new CurriculosService(prisma, null, docClientFalhando(), null, null, null, new ArmazenamentoMemoria(), jobs);

  await assert.rejects(service.gerarArquivos('usuario-1', 'cv-1'), (err) => err instanceof ServiceUnavailableException);
  assert.equal(atualizacoes[0].degradacao, DEGRADACAO_RENDERIZACAO);
  assert.equal(atualizacoes[0].docxPath, null);
});
