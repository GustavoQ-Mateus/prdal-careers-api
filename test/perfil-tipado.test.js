const assert = require('node:assert/strict');
const test = require('node:test');
const { perfilParaIa } = require('../dist/perfil/perfil.normalizacao');
const { ContextoService } = require('../dist/contexto/contexto.service');

const perfilTexto = {
  nome: 'Pessoa',
  resumo: 'Resumo',
  experiencias: [],
  formacao: ['Universidade A | ADS | 02/2023 - 12/2025'],
  certificacoes: ['Python, Escola A, 2025'],
  idiomas: ['Português, nativo'],
  skills: ['Python'],
};

const perfilObjeto = {
  ...perfilTexto,
  formacao: [
    { id: 'f1', grau: 'Tecnólogo', status: 'em_andamento', instituicao: 'Universidade A', curso: 'ADS', inicioMes: 2, inicioAno: 2023 },
    { id: 'f2', grau: 'Bacharelado', status: 'concluido', instituicao: 'Universidade B', curso: 'Física', inicioMes: '03', inicioAno: '2015', fimMes: 12, fimAno: 2019 },
  ],
  certificacoes: [{ id: 'c1', titulo: 'Python', descricao: 'Escola A, 2025' }],
};

async function documentosIndexados(perfil) {
  let inseridos = [];
  const prisma = {
    perfilMestre: { findUnique: async () => perfil },
    candidatura: { findMany: async () => [] },
  };
  const colecao = {
    deleteMany: async () => {},
    insertMany: async (docs) => { inseridos = docs; },
    find: () => ({ toArray: async () => inseridos }),
  };
  const mongo = { documentosRag: () => colecao };
  const lotes = { criar: async () => ({ id: 'lote-1' }) };
  await new ContextoService(prisma, mongo, lotes).reindexar('usuario-1');
  return inseridos;
}

test('perfilParaIa aceita formacao e certificacao em texto', () => {
  const ia = perfilParaIa(perfilTexto);
  assert.deepEqual(ia.formacao, ['Universidade A | ADS | 02/2023 - 12/2025']);
  assert.deepEqual(ia.certificacoes, ['Python, Escola A, 2025']);
});

test('perfilParaIa converte formacao e certificacao em objeto para texto legivel', () => {
  const ia = perfilParaIa(perfilObjeto);
  assert.deepEqual(ia.formacao, [
    'Universidade A | Tecnólogo em ADS | 02/2023 - atual | em andamento',
    'Universidade B | Bacharelado em Física | 03/2015 - 12/2019 | concluído',
  ]);
  assert.deepEqual(ia.certificacoes, ['Python, Escola A, 2025']);
});

test('reindexacao do RAG nunca grava [object Object] nos dois formatos', async () => {
  for (const perfil of [perfilTexto, perfilObjeto]) {
    const docs = await documentosIndexados(perfil);
    const formacoes = docs.filter((d) => d.origemId.startsWith('formacao-'));
    const certificacoes = docs.filter((d) => d.origemId.startsWith('certificacao-'));
    assert.equal(formacoes.length, perfil.formacao.length);
    assert.equal(certificacoes.length, perfil.certificacoes.length);
    for (const doc of docs) assert.doesNotMatch(doc.texto, /\[object Object\]/);
  }
  const docs = await documentosIndexados(perfilObjeto);
  assert.match(docs.find((d) => d.origemId === 'formacao-0').texto, /Universidade A \| Tecnólogo em ADS/);
});
