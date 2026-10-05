const assert = require('node:assert/strict');
const test = require('node:test');
const { ArmazenamentoS3, configuracaoS3, chaveDoCurriculo, disposicaoAnexo } = require('../dist/arquivos/armazenamento');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');
const { ArmazenamentoMemoria } = require('./helpers/armazenamento');

const ENV = {
  S3_BUCKET: 'prdal-arquivos',
  S3_ENDPOINT: 'http://s3:8333',
  S3_ENDPOINT_PUBLICO: 'http://localhost:8333',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'chave',
  AWS_SECRET_ACCESS_KEY: 'segredo',
};

test('url assinada aponta para o endpoint publico e nunca vale mais de 5 minutos', async (t) => {
  for (const [k, v] of Object.entries({ AWS_ACCESS_KEY_ID: 'chave', AWS_SECRET_ACCESS_KEY: 'segredo' })) {
    const antes = process.env[k];
    process.env[k] = v;
    t.after(() => (antes === undefined ? delete process.env[k] : (process.env[k] = antes)));
  }
  const s3 = new ArmazenamentoS3({ ...ENV, S3_URL_VALIDADE_S: '3600' });
  const { url, expiraEm } = await s3.urlDeDownload('usuarios/u1/curriculos/cv.pdf', 'Currículo · ACME.pdf');
  const endereco = new URL(url);
  assert.equal(endereco.origin, 'http://localhost:8333');
  assert.equal(endereco.pathname, '/prdal-arquivos/usuarios/u1/curriculos/cv.pdf');
  assert.equal(endereco.searchParams.get('X-Amz-Expires'), '300');
  assert.match(endereco.searchParams.get('response-content-disposition'), /^attachment; filename="Curriculo  ACME.pdf"; filename\*=UTF-8''Curr%C3%ADculo%20%C2%B7%20ACME\.pdf$/);
  assert.ok(Date.parse(expiraEm) - Date.now() <= 300_000);
});

test('configuracao exige bucket, limita a validade e usa o endpoint interno quando nao ha publico', () => {
  assert.throws(() => configuracaoS3({}), /S3_BUCKET/);
  assert.equal(configuracaoS3({ S3_BUCKET: 'b', S3_URL_VALIDADE_S: '60' }).validadeS, 60);
  assert.equal(configuracaoS3({ S3_BUCKET: 'b', S3_URL_VALIDADE_S: '999' }).validadeS, 300);
  assert.equal(configuracaoS3({ S3_BUCKET: 'b', S3_ENDPOINT: 'http://s3:8333' }).endpointPublico, 'http://s3:8333');
  assert.equal(configuracaoS3({ S3_BUCKET: 'b' }).endpoint, undefined);
  assert.doesNotThrow(() => new ArmazenamentoS3({}));
});

test('chave do curriculo fica sob o usuario e o nome do anexo nao quebra o cabecalho', () => {
  assert.equal(chaveDoCurriculo('u1', 'cv', 'zip'), 'usuarios/u1/curriculos/cv.zip');
  assert.equal(disposicaoAnexo('a"b\\c.pdf'), `attachment; filename="abc.pdf"; filename*=UTF-8''a%22b%5Cc.pdf`);
});

test('gerar os arquivos de novo grava pdf e docx por chave, invalida o pacote antigo e pede um novo ao worker', async () => {
  const atualizacoes = [];
  const prisma = {
    curriculo: {
      findFirst: async () => ({ id: 'cv-1', rotulo: 'V1', markdown: '# Pessoa', degradacao: null, docxPath: null, pdfPath: null, vaga: { id: 'v', titulo: 'T', empresa: 'E' }, candidaturas: [] }),
      update: async ({ data }) => { atualizacoes.push(data); },
    },
  };
  const doc = { renderPdf: async () => Buffer.from('/Type /Page'), renderDocx: async () => Buffer.from('docx') };
  prisma.$transaction = async (fn) => fn(prisma);
  const enfileirados = [];
  const jobs = { criar: async (_tx, job) => ({ id: 'job-pacote', ...job }), enfileirar: async (lista) => enfileirados.push(...lista) };
  const armazenamento = new ArmazenamentoMemoria();
  const service = new CurriculosService(prisma, null, doc, null, null, null, armazenamento, jobs);
  await service.gerarArquivos('u1', 'cv-1');
  assert.deepEqual(enfileirados.map((j) => [j.tipo, j.referenciaId, j.usuarioId]), [['empacotar_curriculo', 'cv-1', 'u1']]);
  assert.deepEqual([atualizacoes[0].pdfPath, atualizacoes[0].docxPath, atualizacoes[0].pacotePath], ['usuarios/u1/curriculos/cv-1.pdf', 'usuarios/u1/curriculos/cv-1.docx', null]);
  assert.equal(armazenamento.objetos.get('usuarios/u1/curriculos/cv-1.pdf').tipo, 'application/pdf');
});
