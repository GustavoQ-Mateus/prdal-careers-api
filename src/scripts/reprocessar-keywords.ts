import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AiClient } from '../clients/ai.client';
import { ClientsModule } from '../clients/clients.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({ imports: [PrismaModule, ClientsModule] })
class ReprocessarKeywordsModule {}

async function main() {
  const logger = new Logger('ReprocessarKeywords');
  const app = await NestFactory.createApplicationContext(ReprocessarKeywordsModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const ai = app.get(AiClient);
    const vagas = await prisma.vaga.findMany({
      where: { keywordsStatus: 'PENDENTE' },
      select: { id: true, descricao: true },
      orderBy: { atualizadoEm: 'asc' },
    });
    let validas = 0;
    let pendentes = 0;
    for (const vaga of vagas) {
      try {
        const extracao = await ai.keywords(vaga.descricao);
        await prisma.vaga.update({
          where: { id: vaga.id },
          data: {
            keywords: extracao.keywords as unknown as Prisma.InputJsonValue,
            keywordsStatus: extracao.status,
          },
        });
        if (extracao.status === 'VALIDAS') validas += 1;
        else pendentes += 1;
      } catch (err) {
        pendentes += 1;
        logger.warn(`vaga ${vaga.id} mantida pendente: ${(err as Error).message}`);
      }
    }
    logger.log(JSON.stringify({ total: vagas.length, validas, pendentes }));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
