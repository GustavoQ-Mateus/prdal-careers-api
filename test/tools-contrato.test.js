const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { contratoDasTools } = require('../dist/scripts/exportar-tools');
const { TOOLS, TOOLS_NATIVAS } = require('../dist/copiloto/tools');

test('contrato das tools traz a definicao nativa e o efeito de cada tool', () => {
  const contrato = contratoDasTools();
  assert.deepEqual(contrato.tools, TOOLS_NATIVAS);
  assert.deepEqual(Object.keys(contrato.efeitos).sort(), TOOLS.map((t) => t.nome).sort());
  assert.equal(contrato.efeitos.registrar_candidatura, 'escrita');
  assert.equal(contrato.efeitos.redigir_mensagem_recrutador, 'entrega_externa');
});

test('script grava o contrato no arquivo pedido', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'contrato-'));
  try {
    const destino = path.join(pasta, 'tools.json');
    execFileSync(process.execPath, [path.join(__dirname, '../dist/scripts/exportar-tools.js'), destino]);
    assert.deepEqual(JSON.parse(fs.readFileSync(destino, 'utf8')), JSON.parse(JSON.stringify(contratoDasTools())));
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
