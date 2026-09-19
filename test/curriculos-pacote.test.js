const assert = require('node:assert/strict');
const test = require('node:test');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { CurriculosService } = require('../dist/curriculos/curriculos.service');

async function criarServico(curriculo) {
  const pasta = await mkdtemp(path.join(os.tmpdir(), 'prdal-pacote-'));
  const docxPath = path.join(pasta, 'curriculo.docx');
  const pdfPath = path.join(pasta, 'curriculo.pdf');
  if (curriculo.docxPath) await writeFile(docxPath, Buffer.from('docx'));
  if (curriculo.pdfPath) await writeFile(pdfPath, Buffer.from('pdf'));
  const registro = { ...curriculo, docxPath: curriculo.docxPath ? docxPath : null, pdfPath: curriculo.pdfPath ? pdfPath : null };
  return {
    pasta,
    service: new CurriculosService({ curriculo: { findFirst: async () => registro } }, null, null, null),
  };
}

test('pacote contem markdown e formatos disponiveis com nome sanitizado', async () => {
  const { pasta, service } = await criarServico({
    id: 'cv-1', rotulo: 'Versao: 1/Principal', markdown: '# Curriculo', docxPath: 'disponivel', pdfPath: 'disponivel',
    vaga: { titulo: 'Dev/Web', empresa: 'ACME: Brasil' },
  });
  try {
    const pacote = await service.pacote('user-1', 'cv-1');
    assert.ok(pacote.buffer.length > 0);
    assert.equal(pacote.buffer.subarray(0, 2).toString(), 'PK');
    assert.equal(pacote.nome, 'DevWeb - ACME Brasil.zip');
    assert.match(pacote.buffer.toString(), /Curriculo_Versao 1Principal\.(md|docx|pdf)/);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});

test('pacote mantem markdown quando docx e pdf nao estao disponiveis', async () => {
  const { pasta, service } = await criarServico({
    id: 'cv-2', rotulo: 'Versao 2', markdown: '# Curriculo', vaga: { titulo: 'Backend', empresa: 'ACME' },
  });
  try {
    const pacote = await service.pacote('user-1', 'cv-2');
    const conteudo = pacote.buffer.toString();
    assert.match(conteudo, /Curriculo_Versao 2\.md/);
    assert.doesNotMatch(conteudo, /Curriculo_Versao 2\.(docx|pdf)/);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});
