import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export interface RelatorioEmails {
  antes: { total: number; naoNormalizados: number };
  depois: { total: number; naoNormalizados: number } | null;
  colisoes: { email: string; contas: { id: string; email: string }[] }[];
  ok: boolean;
}

export async function conferirEmails(prisma: PrismaClient) {
  const contas = await prisma.usuario.findMany({ select: { id: true, email: true }, orderBy: { criadoEm: 'asc' } });
  const grupos = new Map<string, { id: string; email: string }[]>();
  for (const conta of contas) {
    const email = conta.email.trim().toLowerCase();
    grupos.set(email, [...(grupos.get(email) ?? []), conta]);
  }
  return {
    total: contas.length,
    naoNormalizados: contas.filter((conta) => conta.email !== conta.email.trim().toLowerCase()).length,
    colisoes: [...grupos].filter(([, contas]) => contas.length > 1).map(([email, contas]) => ({ email, contas })),
  };
}

export async function migrarEmails(url: string): Promise<RelatorioEmails> {
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const antes = await conferirEmails(prisma);
    const relatorio: RelatorioEmails = {
      antes: { total: antes.total, naoNormalizados: antes.naoNormalizados },
      depois: null,
      colisoes: antes.colisoes,
      ok: false,
    };
    if (antes.colisoes.length) return relatorio;
    const raiz = path.resolve(__dirname, '..', '..');
    const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: raiz,
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf8',
      shell: true,
    });
    if (deploy.status !== 0) throw new Error(`migrate deploy falhou: ${deploy.stderr || deploy.stdout}`);
    const depois = await conferirEmails(prisma);
    relatorio.depois = { total: depois.total, naoNormalizados: depois.naoNormalizados };
    relatorio.ok = depois.total === antes.total && depois.naoNormalizados === 0;
    return relatorio;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('defina DATABASE_URL explicitamente com o banco que vai ser migrado');
    process.exitCode = 1;
    return;
  }
  const relatorio = await migrarEmails(url);
  console.log(JSON.stringify(relatorio, null, 2));
  if (!relatorio.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
