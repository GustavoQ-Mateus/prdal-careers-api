const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const PG = process.env.PRDAL_TESTE_POSTGRES_URL;
const SEM_PG = !PG && 'defina PRDAL_TESTE_POSTGRES_URL com um banco descartavel';
let migrado = false;

function prismaDoBanco(t) {
  if (!migrado) {
    const raiz = path.resolve(__dirname, '..', '..');
    const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: raiz, env: { ...process.env, DATABASE_URL: PG }, encoding: 'utf8', shell: true });
    assert.equal(deploy.status, 0, deploy.stderr + deploy.stdout);
    migrado = true;
  }
  const { PrismaClient } = require('@prisma/client');
  const cliente = new PrismaClient({ datasourceUrl: PG });
  t.after(() => cliente.$disconnect());
  return cliente;
}

async function novoUsuario(prisma) {
  return prisma.usuario.create({ data: { email: `teste-${randomUUID()}@exemplo.dev`, senhaHash: 'x' } });
}

module.exports = { PG, SEM_PG, prismaDoBanco, novoUsuario };
