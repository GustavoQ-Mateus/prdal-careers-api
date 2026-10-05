const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const MIGRACOES = path.join(RAIZ, 'prisma', 'migrations');
const BASELINE = '20261005000000_baseline';
const DDL = /\b(CREATE|ALTER|DROP)\s+(UNIQUE\s+)?(TABLE|INDEX|TYPE|SCHEMA)\b/i;

function ler(arquivo) {
  return fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
}

function arquivos(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name);
    return item.isDirectory() ? arquivos(caminho) : [caminho];
  });
}

function prisma(args, env) {
  return spawnSync('npx', ['prisma', ...args], { cwd: RAIZ, env: { ...process.env, ...env }, encoding: 'utf8', shell: true });
}

test('schema so muda por migracao versionada com baseline e indices parciais', () => {
  assert.equal(fs.existsSync(path.join(RAIZ, 'prisma', 'sql')), false);
  assert.match(ler(path.join(MIGRACOES, 'migration_lock.toml')), /provider = "postgresql"/);
  const pastas = fs.readdirSync(MIGRACOES).filter((nome) => fs.statSync(path.join(MIGRACOES, nome)).isDirectory()).sort();
  assert.equal(pastas[0], BASELINE);
  const baseline = ler(path.join(MIGRACOES, BASELINE, 'migration.sql'));
  assert.match(baseline, /CREATE UNIQUE INDEX "candidaturas_vaga_principal_uidx" ON "candidaturas"\("vaga_id"\) WHERE "principal" = true;/);
  assert.match(baseline, /CREATE UNIQUE INDEX "acoes_principal_pendente_uidx"/);
  assert.match(baseline, /CREATE TABLE "pipelines_ats"/);
  const todas = pastas.map((nome) => ler(path.join(MIGRACOES, nome, 'migration.sql'))).join('\n');
  for (const indice of ['curriculos_vaga_id_idx', 'candidaturas_curriculo_id_idx', 'lote_itens_lote_id_idx', 'geracoes_curriculo_vaga_id_idx']) {
    assert.match(todas, new RegExp(`CREATE INDEX "${indice}"`), indice);
  }
});

test('boot da api nao aplica schema, DDL nem backfill', () => {
  const dockerfile = ler(path.join(RAIZ, 'Dockerfile'));
  assert.doesNotMatch(dockerfile, /db push|migrate/);
  assert.match(dockerfile, /CMD \["node", "dist\/main\.js"\]/);
  const codigo = arquivos(path.join(RAIZ, 'src')).filter((f) => f.endsWith('.ts') && !f.includes(`${path.sep}scripts${path.sep}`));
  for (const arquivo of codigo) assert.doesNotMatch(ler(arquivo), DDL, arquivo);
  const prismaService = ler(path.join(RAIZ, 'src', 'prisma', 'prisma.service.ts'));
  assert.doesNotMatch(prismaService, /\$executeRaw|UPDATE/);
});

test('compose roda a migracao num passo proprio antes da api', () => {
  const compose = ler(path.resolve(RAIZ, '..', '..', 'infra', 'docker-compose.yml'));
  assert.match(compose, /migracao:\n(?:.*\n)*?\s+command: \["npx", "prisma", "migrate", "deploy"\]/);
  assert.match(compose, /migracao:\n\s+condition: service_completed_successfully/);
});

test('banco vazio com migrate deploy bate com o schema', { skip: !process.env.PRDAL_TESTE_POSTGRES_URL && 'defina PRDAL_TESTE_POSTGRES_URL com um banco descartavel' }, () => {
  const url = process.env.PRDAL_TESTE_POSTGRES_URL;
  const deploy = prisma(['migrate', 'deploy'], { DATABASE_URL: url });
  assert.equal(deploy.status, 0, deploy.stderr + deploy.stdout);
  const diff = prisma(['migrate', 'diff', '--from-url', `"${url}"`, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], {});
  assert.equal(diff.status, 0, diff.stdout);
  assert.match(diff.stdout, /No difference detected/);
});
