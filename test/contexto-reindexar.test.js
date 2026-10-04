const assert = require('node:assert/strict');
const test = require('node:test');
const { ContextoService } = require('../dist/contexto/contexto.service');
const { tipoPadraoRag } = require('../dist/mongo/mongo.service');

function servico(perfil, candidaturas = []) {
  const inseridos = [];
  const prisma = {
    perfilMestre: { findUnique: async () => perfil },
    candidatura: { findMany: async () => candidaturas },
  };
  const mongo = {
    documentosRag: () => ({
      deleteMany: async () => {},
      insertMany: async (docs) => inseridos.push(...docs),
      find: () => ({ toArray: async () => inseridos }),
    }),
  };
  const lotes = { criar: async () => ({ id: 'lote-1' }) };
  return { service: new ContextoService(prisma, mongo, lotes), inseridos };
}

test('cada unidade do perfil vira um documento factual com tipo e a experiencia usa o id do perfil', async () => {
  const { service, inseridos } = servico(
    {
      resumo: 'Analista de dados.',
      experiencias: [
        { id: 'exp-a', cargo: 'Analista', empresa: 'Empresa A', descricao: 'Modelei paineis em Power BI.' },
      ],
      formacao: [],
      certificacoes: [],
      idiomas: ['Ingles'],
      skills: ['SQL', 'Power BI'],
    },
    [{ id: 'cand-1', notas: 'quero estudar Kubernetes', vaga: { titulo: 'Dados' } }],
  );
  await service.reindexar('usuario-1');
  const porTipo = Object.fromEntries(inseridos.map((d) => [d.tipo, d]));
  assert.equal(porTipo.experiencia.origemId, 'exp-a');
  assert.equal(porTipo.experiencia.factual, true);
  assert.equal(porTipo.resumo.factual, true);
  assert.equal(porTipo.skills.factual, true);
  assert.equal(porTipo.idiomas.factual, true);
  assert.equal(porTipo.candidatura.factual, false);
});

test('documento antigo sem tipo recebe tipo pela origem', () => {
  assert.equal(tipoPadraoRag('perfil', 'resumo'), 'resumo');
  assert.equal(tipoPadraoRag('perfil', 'formacao-0'), 'formacao');
  assert.equal(tipoPadraoRag('perfil', 'experiencia-exp-a'), 'experiencia');
  assert.equal(tipoPadraoRag('nota', 'n1'), 'nota');
  assert.equal(tipoPadraoRag('candidatura', 'c1'), 'candidatura');
});
