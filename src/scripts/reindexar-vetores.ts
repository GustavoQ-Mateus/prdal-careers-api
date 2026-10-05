import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RagModule } from '../rag/rag.module';
import { RagService } from '../rag/rag.service';
import { reindexarDesatualizados } from '../rag/reindexacao';
import { RepositoriosModule } from '../repositorios/repositorios.module';

@Module({ imports: [PrismaModule, RepositoriosModule, RagModule] })
class ReindexarVetoresModule {}

async function main() {
  const todos = process.argv.includes('--todos');
  const app = await NestFactory.createApplicationContext(ReindexarVetoresModule, { logger: ['error', 'warn'] });
  try {
    const resultado = await reindexarDesatualizados(app.get(PrismaService), app.get(RagService), { todos });
    console.log(JSON.stringify(resultado, null, 2));
    if (resultado.falhas.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
