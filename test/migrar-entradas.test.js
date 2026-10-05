const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { PG, SEM_PG } = require('./helpers/postgres');

const RAIZ = path.resolve(__dirname, '..');
const PRIMEIRA_NOVA = '20261005001100_oportunidade_entrada';

function urlDoBanco(nome) {
  const url = new URL(PG);
  url.pathname = `/${nome}`;
  return url.toString();
}

function migracoesAntigas(url) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prdal-entradas-'));
  const origem = path.join(RAIZ, 'prisma', 'migrations');
  fs.mkdirSync(path.join(pasta, 'migrations'));
  for (const nome of fs.readdirSync(origem)) {
    if (nome >= PRIMEIRA_NOVA && nome !== 'migration_lock.toml') continue;
    fs.cpSync(path.join(origem, nome), path.join(pasta, 'migrations', nome), { recursive: true });
  }
  fs.writeFileSync(path.join(pasta, 'schema.prisma'), 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n');
  const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', `"${path.join(pasta, 'schema.prisma')}"`], { cwd: RAIZ, env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', shell: true });
  fs.rmSync(pasta, { recursive: true, force: true });
  assert.equal(deploy.status, 0, deploy.stderr + deploy.stdout);
}

test('migracao das entradas: crua vira oportunidade em entrada com o mesmo id, lote aponta para a vaga e rodar de novo nao muda nada', { skip: SEM_PG }, async (t) => {
  const { PrismaClient } = require('@prisma/client');
  const { migrarEntradas } = require('../dist/scripts/migrar-entradas');
  const nome = `entradas_${randomUUID().replace(/-/g, '')}`;
  const admin = new PrismaClient({ datasourceUrl: PG });
  await admin.$executeRawUnsafe(`CREATE DATABASE ${nome}`);
  t.after(async () => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
    await admin.$disconnect();
  });
  const url = urlDoBanco(nome);
  migracoesAntigas(url);

  const banco = new PrismaClient({ datasourceUrl: url });
  t.after(() => banco.$disconnect());
  const usuario = randomUUID();
  const vaga = randomUUID();
  const ids = { pronta: randomUUID(), pendente: randomUUID(), ativada: randomUUID(), orfa: randomUUID() };
  await banco.$executeRawUnsafe(`INSERT INTO usuarios (id, email, senha_hash) VALUES ('${usuario}', '${usuario}@exemplo.dev', 'x')`);
  await banco.$executeRawUnsafe(`INSERT INTO vagas (id, usuario_id, titulo, empresa, descricao, keywords, origem, origem_importacao_id, atualizado_em) VALUES ('${vaga}', '${usuario}', 'Ativada', 'A', 'd', '[]', 'IMPORTACAO', '${ids.ativada}', now())`);
  await banco.$executeRawUnsafe(`INSERT INTO banco_vagas (id, usuario_id, titulo, empresa, descricao, status, categoria, keywords, keywords_status, vaga_id, criado_em) VALUES
    ('${ids.pronta}', '${usuario}', 'Pronta', 'B', 'd', 'CRUA', 'dados', '[{"termo":"SQL","peso":3}]', 'VALIDAS', NULL, '2026-09-01T10:00:00Z'),
    ('${ids.pendente}', '${usuario}', 'Pendente', 'C', 'd', 'CRUA', NULL, NULL, 'PENDENTE', NULL, '2026-09-02T10:00:00Z'),
    ('${ids.ativada}', '${usuario}', 'Ativada', 'A', 'd', 'ATIVADA', NULL, NULL, 'PENDENTE', '${vaga}', '2026-09-03T10:00:00Z'),
    ('${ids.orfa}', '${usuario}', 'Orfa', 'D', 'd', 'ATIVADA', NULL, NULL, 'PENDENTE', NULL, '2026-09-04T10:00:00Z')`);
  const lote = randomUUID();
  await banco.$executeRawUnsafe(`INSERT INTO lotes (id, usuario_id, tipo, total) VALUES ('${lote}', '${usuario}', 'IMPORTACAO', 4)`);
  const itens = Object.fromEntries(Object.keys(ids).map((chave) => [chave, randomUUID()]));
  for (const chave of Object.keys(ids)) {
    await banco.$executeRawUnsafe(`INSERT INTO lote_itens (id, lote_id, banco_vaga_id) VALUES ('${itens[chave]}', '${lote}', '${ids[chave]}')`);
  }

  const primeira = await migrarEntradas(url);
  assert.deepEqual(primeira.antes, {
    bancoVagas: { crua: 2, ativada: 2, ativadaSemOportunidade: 1 },
    vagas: { total: 1, entrada: null },
    loteItens: { comBancoVaga: 4, comVaga: null },
  });
  assert.deepEqual(primeira.depois, {
    bancoVagas: null,
    vagas: { total: 3, entrada: 2 },
    loteItens: { comBancoVaga: null, comVaga: 3 },
  });
  assert.deepEqual([primeira.entradasEsperadas, primeira.entradasEncontradas, primeira.ok], [2, 2, true]);

  const pronta = await banco.vaga.findUnique({ where: { id: ids.pronta } });
  assert.deepEqual([pronta.estagio, pronta.origem, pronta.keywordsStatus, pronta.keywordsExtracao, pronta.categoria], ['ENTRADA', 'IMPORTACAO', 'VALIDAS', 'PRONTAS', 'dados']);
  assert.equal(pronta.criadoEm.toISOString(), '2026-09-01T10:00:00.000Z');
  const pendente = await banco.vaga.findUnique({ where: { id: ids.pendente } });
  assert.deepEqual([pendente.estagio, pendente.keywordsExtracao, pendente.keywords], ['ENTRADA', 'PENDENTE', []]);
  assert.equal((await banco.vaga.findUnique({ where: { id: vaga } })).estagio, 'ATIVA');
  const porItem = Object.fromEntries((await banco.loteItem.findMany({ where: { loteId: lote } })).map((i) => [i.id, i.vagaId]));
  assert.deepEqual(
    Object.fromEntries(Object.keys(ids).map((chave) => [chave, porItem[itens[chave]]])),
    { pronta: ids.pronta, pendente: ids.pendente, ativada: vaga, orfa: null },
  );

  const segunda = await migrarEntradas(url);
  assert.deepEqual(segunda.antes, primeira.depois);
  assert.deepEqual(segunda.depois, primeira.depois);
  assert.equal(segunda.ok, true);
});

test('script recusa rodar sem DATABASE_URL explicito', () => {
  const script = path.join(RAIZ, 'dist', 'scripts', 'migrar-entradas.js');
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const resultado = spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /defina DATABASE_URL/);
});
