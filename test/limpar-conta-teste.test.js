const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { lerOpcoes } = require('../dist/scripts/limpar-conta-teste');

const TESTE = { PRDAL_AMBIENTE: 'teste' };

test('dry-run e o padrao e a execucao exige --executar', () => {
  assert.deepEqual(lerOpcoes(['--email', 'conta@teste.dev'], TESTE), { email: 'conta@teste.dev', executar: false });
  assert.deepEqual(lerOpcoes(['--email=Conta@Teste.dev', '--dry-run'], TESTE), { email: 'conta@teste.dev', executar: false });
  assert.deepEqual(lerOpcoes(['--email', 'conta@teste.dev', '--executar'], { PRDAL_AMBIENTE: 'desenvolvimento' }), {
    email: 'conta@teste.dev',
    executar: true,
  });
  assert.throws(() => lerOpcoes(['--email', 'conta@teste.dev', '--dry-run', '--executar'], TESTE), /nao os dois/);
});

test('alvo por argumento e obrigatorio', () => {
  assert.throws(() => lerOpcoes([], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--executar'], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--email'], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--email', 'sem-arroba'], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--alvo', 'conta@teste.dev'], TESTE), /desconhecido/);
});

test('recusa fora de teste ou desenvolvimento', () => {
  for (const env of [{}, { PRDAL_AMBIENTE: 'producao' }, { PRDAL_AMBIENTE: '' }, { NODE_ENV: 'development' }]) {
    assert.throws(() => lerOpcoes(['--email', 'conta@teste.dev', '--executar'], env), /PRDAL_AMBIENTE/);
  }
});

test('o script recusa antes de conectar em banco e nao tem email no codigo', () => {
  const script = path.join(__dirname, '../dist/scripts/limpar-conta-teste.js');
  const { PRDAL_AMBIENTE: _ignorado, ...env } = process.env;
  const execucao = spawnSync(process.execPath, [script, '--email', 'conta@teste.dev', '--executar'], {
    env: { ...env, DATABASE_URL: 'postgresql://ninguem:x@127.0.0.1:1/nada', MONGO_URL: 'mongodb://127.0.0.1:1' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(execucao.status, 1);
  assert.match(execucao.stderr, /limpeza recusada/);

  const fonte = readFileSync(path.join(__dirname, '../src/scripts/limpar-conta-teste.ts'), 'utf8');
  assert.doesNotMatch(fonte, /[\w.+-]+@[\w-]+\.[\w.]+/);
});
