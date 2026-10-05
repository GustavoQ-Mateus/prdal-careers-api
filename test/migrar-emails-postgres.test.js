const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { migrarEmails } = require('../dist/scripts/migrar-emails');

test('script recusa colisao no postgres sem alterar contas', { skip: !process.env.PRDAL_TESTE_EMAIL_MIGRACAO }, async () => {
  const url = process.env.PRDAL_TESTE_POSTGRES_URL;
  assert.ok(url, 'defina PRDAL_TESTE_POSTGRES_URL com banco descartavel');
  const prisma = new PrismaClient({ datasourceUrl: url });
  const sufixo = randomUUID();
  const email = `colisao-${sufixo}@teste.dev`;
  const ids = [randomUUID(), randomUUID()];
  await prisma.$executeRawUnsafe('ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_email_minusculo_chk"');
  try {
    await prisma.usuario.create({ data: { id: ids[0], email: email.toUpperCase(), senhaHash: 'hash' } });
    await prisma.usuario.create({ data: { id: ids[1], email, senhaHash: 'hash' } });
    const relatorio = await migrarEmails(url);
    assert.equal(relatorio.ok, false);
    assert.equal(relatorio.depois, null);
    assert.deepEqual(relatorio.colisoes.find((item) => item.email === email).contas.map((conta) => conta.id).sort(), ids.sort());
    const contas = await prisma.usuario.findMany({ where: { id: { in: ids } }, orderBy: { criadoEm: 'asc' } });
    assert.deepEqual(contas.map((conta) => conta.email).sort(), [email.toUpperCase(), email].sort());
  } finally {
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.$executeRawUnsafe('ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_email_minusculo_chk" CHECK ("email" = lower(trim("email")))');
    await prisma.$disconnect();
  }
});
