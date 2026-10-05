import { Injectable, Logger } from '@nestjs/common';
import { Job, Prisma, TipoJob } from '@prisma/client';
import { requestIdAtual } from '../observabilidade/contexto';
import { PrismaService } from '../prisma/prisma.service';
import { Fila } from './fila';

export interface NovoJob {
  tipo: TipoJob;
  usuarioId: string;
  referenciaId: string;
  entrada?: Prisma.InputJsonValue;
}

type JobEnfileiravel = Pick<Job, 'id' | 'tipo'>;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fila: Fila,
  ) {}

  criar(tx: Prisma.TransactionClient, job: NovoJob): Promise<Job> {
    return tx.job.create({
      data: {
        tipo: job.tipo,
        usuarioId: job.usuarioId,
        referenciaId: job.referenciaId,
        requestId: requestIdAtual() ?? null,
        ...(job.entrada !== undefined ? { entrada: job.entrada } : {}),
      },
    });
  }

  async enfileirar(jobs: JobEnfileiravel[]): Promise<number> {
    let enviados = 0;
    for (const job of jobs) {
      try {
        await this.fila.enviar({ jobId: job.id, tipo: job.tipo });
        await this.prisma.job.updateMany({ where: { id: job.id, status: 'PENDENTE' }, data: { enfileiradoEm: new Date() } });
        enviados += 1;
      } catch (err) {
        this.logger.warn({
          mensagem: 'job nao enfileirado; fica pendente para a varredura do worker',
          jobId: job.id,
          tipo: job.tipo,
          erro: (err as Error).message,
        });
      }
    }
    return enviados;
  }
}
