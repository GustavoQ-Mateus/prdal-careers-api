import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export interface Contagens {
  bancoVagas: { crua: number; ativada: number; ativadaSemOportunidade: number } | null;
  vagas: { total: number; entrada: number | null };
  loteItens: { comBancoVaga: number | null; comVaga: number | null };
}

export interface RelatorioEntradas {
  antes: Contagens;
  depois: Contagens;
  entradasEsperadas: number;
  entradasEncontradas: number;
  ok: boolean;
}

async function existeTabela(prisma: PrismaClient, tabela: string): Promise<boolean> {
  const [linha] = await prisma.$queryRawUnsafe<{ existe: boolean }[]>(`SELECT to_regclass('public.${tabela}') IS NOT NULL AS existe`);
  return linha.existe;
}

async function existeColuna(prisma: PrismaClient, tabela: string, coluna: string): Promise<boolean> {
  const [linha] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT count(*) AS total FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tabela}' AND column_name = '${coluna}'`,
  );
  return Number(linha.total) > 0;
}

async function contar(prisma: PrismaClient, sql: string): Promise<number> {
  const [linha] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(sql);
  return Number(linha.total);
}

export async function contarEntradas(prisma: PrismaClient): Promise<Contagens> {
  const banco = await existeTabela(prisma, 'banco_vagas');
  const estagio = await existeColuna(prisma, 'vagas', 'estagio');
  const comBanco = await existeColuna(prisma, 'lote_itens', 'banco_vaga_id');
  const comVaga = await existeColuna(prisma, 'lote_itens', 'vaga_id');
  return {
    bancoVagas: banco
      ? {
          crua: await contar(prisma, `SELECT count(*) AS total FROM banco_vagas WHERE status = 'CRUA'`),
          ativada: await contar(prisma, `SELECT count(*) AS total FROM banco_vagas WHERE status = 'ATIVADA'`),
          ativadaSemOportunidade: await contar(prisma, `SELECT count(*) AS total FROM banco_vagas WHERE status = 'ATIVADA' AND vaga_id IS NULL`),
        }
      : null,
    vagas: {
      total: await contar(prisma, 'SELECT count(*) AS total FROM vagas'),
      entrada: estagio ? await contar(prisma, `SELECT count(*) AS total FROM vagas WHERE estagio = 'ENTRADA'`) : null,
    },
    loteItens: {
      comBancoVaga: comBanco ? await contar(prisma, 'SELECT count(*) AS total FROM lote_itens WHERE banco_vaga_id IS NOT NULL') : null,
      comVaga: comVaga ? await contar(prisma, 'SELECT count(*) AS total FROM lote_itens WHERE vaga_id IS NOT NULL') : null,
    },
  };
}

export async function idsCrus(prisma: PrismaClient): Promise<string[]> {
  if (!(await existeTabela(prisma, 'banco_vagas'))) return [];
  const linhas = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM banco_vagas WHERE status = 'CRUA'`);
  return linhas.map((linha) => linha.id);
}

export async function conferir(prisma: PrismaClient, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  return prisma.vaga.count({ where: { id: { in: ids }, estagio: 'ENTRADA' } });
}

export function aplicarMigracoes(url: string): void {
  const raiz = path.resolve(__dirname, '..', '..');
  const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: raiz, env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', shell: true });
  if (deploy.status !== 0) throw new Error(`migrate deploy falhou: ${deploy.stderr || deploy.stdout}`);
}

export async function migrarEntradas(url: string): Promise<RelatorioEntradas> {
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const antes = await contarEntradas(prisma);
    const ids = await idsCrus(prisma);
    aplicarMigracoes(url);
    const depois = await contarEntradas(prisma);
    const encontradas = await conferir(prisma, ids);
    return { antes, depois, entradasEsperadas: ids.length, entradasEncontradas: encontradas, ok: encontradas === ids.length && depois.bancoVagas === null };
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
  const relatorio = await migrarEntradas(url);
  console.log(JSON.stringify(relatorio, null, 2));
  if (!relatorio.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
