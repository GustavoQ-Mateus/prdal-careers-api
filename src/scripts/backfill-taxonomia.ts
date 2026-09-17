import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AiClient } from '../clients/ai.client';
import { ClientsModule } from '../clients/clients.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({ imports: [PrismaModule, ClientsModule] })
class BackfillModule {}

async function main() {
  const logger = new Logger('BackfillTaxonomia');
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const ai = app.get(AiClient);

    const pendentes = await prisma.vaga.findMany({
      where: { OR: [{ categoria: null }, { nivel: null }] },
      select: { id: true, titulo: true, descricao: true },
    });
    logger.log(`${pendentes.length} oportunidades sem taxonomia completa`);

    let atualizadas = 0;
    for (const vaga of pendentes) {
      try {
        const { categoria, nivel } = await ai.classify(
          vaga.titulo,
          vaga.descricao,
        );
        await prisma.vaga.update({
          where: { id: vaga.id },
          data: { categoria, nivel },
        });
        atualizadas += 1;
      } catch (err) {
        logger.warn(`vaga ${vaga.id} nao classificada: ${(err as Error).message}`);
      }
    }

    logger.log(`backfill concluido, ${atualizadas} linhas atualizadas`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
