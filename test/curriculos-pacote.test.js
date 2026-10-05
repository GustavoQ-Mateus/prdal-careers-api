const assert = require('node:assert/strict');
const test = require('node:test');
const { CurriculosService, ARQUIVO_NAO_MIGRADO, PACOTE_EM_PREPARO } = require('../dist/curriculos/curriculos.service');
const { ArmazenamentoMemoria } = require('./helpers/armazenamento');

function servico(registro) {
  return new CurriculosService({ curriculo: { findFirst: async () => registro } }, null, null, null, null, null, new ArmazenamentoMemoria(), null);
}

test('pacote e arquivos saem por url assinada com nome sanitizado, sem a api ler nem comprimir nada', async () => {
  const service = servico({
    id: 'cv-1', rotulo: 'Versao: 1/Principal', markdown: '# Curriculo',
    docxPath: 'usuarios/u1/curriculos/cv-1.docx', pdfPath: 'usuarios/u1/curriculos/cv-1.pdf', pacotePath: 'usuarios/u1/curriculos/cv-1.zip',
    vaga: { titulo: 'Dev/Web', empresa: 'ACME: Brasil' },
  });
  const pacote = await service.pacote('u1', 'cv-1');
  assert.equal(pacote.url, `http://s3.teste/usuarios/u1/curriculos/cv-1.zip?nome=${encodeURIComponent('DevWeb - ACME Brasil.zip')}`);
  assert.ok(Date.parse(pacote.expiraEm) - Date.now() <= 300_000);
  const pdf = await service.arquivo('u1', 'cv-1', 'pdf');
  assert.match(pdf.url, /usuarios\/u1\/curriculos\/cv-1\.pdf\?nome=Curriculo_Versao%201Principal\.pdf$/);
});

test('pacote ainda nao gravado pelo worker responde 404 com mensagem clara', async () => {
  const service = servico({ id: 'cv-2', rotulo: 'V2', markdown: '#', docxPath: null, pdfPath: null, pacotePath: null, vaga: { titulo: 'B', empresa: 'A' } });
  await assert.rejects(service.pacote('u1', 'cv-2'), (err) => err.getStatus() === 404 && err.message === PACOTE_EM_PREPARO);
});

test('caminho local antigo ainda nao migrado nao vira url e pede nova geracao dos arquivos', async () => {
  const service = servico({ id: 'cv-3', rotulo: 'V3', markdown: '#', docxPath: '/app/storage/cv-3.docx', pdfPath: '/app/storage/cv-3.pdf', pacotePath: null, vaga: { titulo: 'B', empresa: 'A' } });
  await assert.rejects(service.arquivo('u1', 'cv-3', 'docx'), (err) => err.getStatus() === 404 && err.message === ARQUIVO_NAO_MIGRADO);
});
