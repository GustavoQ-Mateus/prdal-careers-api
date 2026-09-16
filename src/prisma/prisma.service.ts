import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.garantirIndices();
    await this.preencherCandidaturasPrincipais();
  }

  private async garantirIndices() {
    try {
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS candidaturas_vaga_principal_uidx
        ON candidaturas (vaga_id)
        WHERE principal = true
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS acoes_principal_pendente_uidx
        ON acoes_oportunidade (vaga_id)
        WHERE principal = true AND concluida_em IS NULL AND cancelada_em IS NULL
      `);
    } catch (err) {
      this.logger.warn(`indices parciais: ${(err as Error).message}`);
    }
  }

  private async preencherCandidaturasPrincipais() {
    try {
      await this.$executeRawUnsafe(`
        UPDATE candidaturas SET principal = true
        WHERE id IN (
          SELECT DISTINCT ON (vaga_id) id
          FROM candidaturas
          WHERE vaga_id NOT IN (
            SELECT vaga_id FROM candidaturas WHERE principal = true
          )
          ORDER BY vaga_id, atualizado_em DESC
        )
      `);
    } catch (err) {
      this.logger.warn(`backfill de candidatura principal: ${(err as Error).message}`);
    }
  }
}
