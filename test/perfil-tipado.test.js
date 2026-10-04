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

test('perfilParaIa envia formacao e certificacao em texto como objeto com a linha inteira', () => {
  const ia = perfilParaIa(perfilTexto);
  assert.deepEqual(ia.formacao, [{
    grau: '',
    status: '',
    instituicao: '',
    curso: 'Universidade A | ADS | 02/2023 - 12/2025',
    inicioMes: null,
    inicioAno: null,
    fimMes: null,
    fimAno: null,
  }]);
  assert.deepEqual(ia.certificacoes, [{ titulo: 'Python, Escola A, 2025', descricao: '' }]);
});

test('perfilParaIa envia formacao e certificacao estruturadas sem marca de revisao', () => {
  const ia = perfilParaIa(perfilObjeto);
  assert.deepEqual(ia.formacao[1], {
    grau: 'Bacharelado',
    status: 'concluido',
    instituicao: 'Universidade B',
    curso: 'Física',
    inicioMes: 3,
    inicioAno: 2015,
    fimMes: 12,
    fimAno: 2019,
  });
  assert.deepEqual(ia.certificacoes, [{ titulo: 'Python', descricao: 'Escola A, 2025' }]);
});

test('perfilParaIa envia contato tipado sem endereco completo e experiencia com datas', () => {
  const ia = perfilParaIa({
    ...perfilObjeto,
    emails: [{ id: 'e1', valor: 'a@exemplo.dev', principal: false }, { id: 'e2', valor: 'b@exemplo.dev', principal: true }],
    telefones: [{ id: 't1', ddi: '+55', numero: '85 90000-0001', principal: true }],
    links: [{ id: 'l1', tipo: 'github', url: 'github.com/exemplo' }],
    endereco: { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza', logradouro: 'Rua Exemplo, 1', bairro: 'Centro' },
    experiencias: [{
      id: 'x1', cargo: 'Dev', empresa: 'A', dataInicioMes: 6, dataInicioAno: 2024, atual: true,
      local: { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' }, descricao: '- Atuei com Python.\nTecnologias: Python, Redis',
    }],
  });
  assert.equal(ia.contato, undefined);
  assert.deepEqual(ia.emails, [{ valor: 'a@exemplo.dev', principal: false }, { valor: 'b@exemplo.dev', principal: true }]);
  assert.deepEqual(ia.telefones, [{ ddi: '+55', numero: '85 90000-0001', principal: true }]);
  assert.deepEqual(ia.links, [{ tipo: 'github', url: 'github.com/exemplo' }]);
  assert.deepEqual(ia.endereco, { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' });
  const [experiencia] = ia.experiencias;
  assert.deepEqual(
    [experiencia.dataInicioMes, experiencia.dataInicioAno, experiencia.dataFimMes, experiencia.dataFimAno, experiencia.atual],
    [6, 2024, null, null, true],
  );
  assert.deepEqual(experiencia.local, { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' });
  assert.deepEqual(experiencia.realizacoes, ['Atuei com Python.']);
  assert.match(experiencia.texto, /Período: 06\/2024 - atual/);
  assert.match(experiencia.texto, /Local: Fortaleza - CE/);
  assert.match(experiencia.texto, /Tecnologias: Python, Redis/);
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
  assert.equal(docs.find((d) => d.origemId === 'formacao-0').texto, 'Universidade A | Tecnólogo em ADS | 02/2023 - atual | em andamento');
  assert.equal(docs.find((d) => d.origemId === 'formacao-1').texto, 'Universidade B | Bacharelado em Física | 03/2015 - 12/2019 | concluído');
  assert.equal(docs.find((d) => d.origemId === 'certificacao-0').texto, 'Python, Escola A, 2025');
});

test('reindexacao do RAG le formacao, certificacao e experiencia do perfil salvo no formato novo', async () => {
  const docs = await documentosIndexados({
    ...perfilObjeto,
    formacao: [{ id: 'f1', grau: 'Tecnólogo', status: 'em_andamento', instituicao: 'Universidade A', curso: 'ADS', inicioMes: 2, inicioAno: 2023, fimMes: null, fimAno: null, revisao: [] }],
    certificacoes: [{ id: 'c1', titulo: 'AWS Cloud Practitioner', descricao: 'Emitida em 2025', revisao: ['formato_antigo'] }],
    experiencias: [{
      id: 'x1', cargo: 'Dev', empresa: 'Empresa A', dataInicioMes: 1, dataInicioAno: 2022, dataFimMes: 12, dataFimAno: 2023, atual: false,
      local: { pais: 'Brasil', estado: 'SP', cidade: 'Campinas' }, descricao: '- Mantive APIs.\nTecnologias: Python',
    }],
  });
  for (const doc of docs) assert.doesNotMatch(doc.texto, /\[object Object\]|undefined|null/);
  assert.equal(docs.find((d) => d.origemId === 'formacao-0').texto, 'Universidade A | Tecnólogo em ADS | 02/2023 - atual | em andamento');
  assert.equal(docs.find((d) => d.origemId === 'certificacao-0').texto, 'AWS Cloud Practitioner, Emitida em 2025');
  assert.equal(
    docs.find((d) => d.tipo === 'experiencia' && d.origemId === 'x1').texto,
    'Cargo: Dev\nEmpresa: Empresa A\nPeríodo: 01/2022 - 12/2023\nLocal: Campinas - SP\n- Mantive APIs.\nTecnologias: Python',
  );
});
