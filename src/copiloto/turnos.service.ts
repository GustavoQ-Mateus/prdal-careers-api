import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const MENSAGEM_TURNO_EM_ANDAMENTO =
  'Já existe uma resposta em andamento nesta conversa. Aguarde ela terminar antes de enviar outra mensagem.';

const LEASE_PADRAO_S = 60;
const RENOVACAO_PADRAO_MS = 15_000;

function numeroPositivo(valor: string | undefined, padrao: number): number {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : padrao;
}

export function leaseTurnoS(env: NodeJS.ProcessEnv = process.env): number {
  return numeroPositivo(env.TURNO_LEASE_S, LEASE_PADRAO_S);
}

export function intervaloHeartbeatMs(env: NodeJS.ProcessEnv = process.env): number {
  return numeroPositivo(env.SSE_HEARTBEAT_MS, RENOVACAO_PADRAO_MS);
}

export interface TurnoAdquirido {
  conversaId: string;
  turnoId: string;
}

@Injectable()
export class TurnosService {
  private readonly logger = new Logger(TurnosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async adquirir(conversaId: string): Promise<TurnoAdquirido | null> {
    const turnoId = randomUUID();
    const linhas = await this.prisma.$queryRaw<{ turno_id: string }[]>(Prisma.sql`
      INSERT INTO turnos_copiloto (conversa_id, turno_id, expira_em)
      VALUES (${conversaId}, ${turnoId}, now() + make_interval(secs => ${leaseTurnoS()}))
      ON CONFLICT (conversa_id) DO UPDATE
        SET turno_id = EXCLUDED.turno_id, expira_em = EXCLUDED.expira_em
        WHERE turnos_copiloto.expira_em < now()
      RETURNING turno_id
    `);
    return linhas.length ? { conversaId, turnoId } : null;
  }

  async exigir(conversaId: string): Promise<TurnoAdquirido> {
    const turno = await this.adquirir(conversaId);
    if (!turno) throw new ConflictException(MENSAGEM_TURNO_EM_ANDAMENTO);
    return turno;
  }

  async renovar(turno: TurnoAdquirido): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE turnos_copiloto SET expira_em = now() + make_interval(secs => ${leaseTurnoS()})
      WHERE conversa_id = ${turno.conversaId} AND turno_id = ${turno.turnoId}
    `);
  }

  async liberar(turno: TurnoAdquirido): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM turnos_copiloto WHERE conversa_id = ${turno.conversaId} AND turno_id = ${turno.turnoId}
    `);
  }

  manter(turno: TurnoAdquirido): () => Promise<void> {
    const relogio = setInterval(() => {
      this.renovar(turno).catch((err) => this.logger.warn(`renovacao do turno falhou: ${(err as Error).message}`));
    }, intervaloHeartbeatMs());
    relogio.unref();
    return async () => {
      clearInterval(relogio);
      await this.liberar(turno).catch((err) => this.logger.warn(`liberacao do turno falhou: ${(err as Error).message}`));
    };
  }
}
