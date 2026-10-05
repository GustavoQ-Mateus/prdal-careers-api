import { Injectable, NotFoundException } from '@nestjs/common';
import { LoteItem, TipoJob } from '@prisma/client';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';

const TIPO_INGESTAO = 'INGESTAO';

function referenciaDoItem(item: Pick<LoteItem, 'vagaId' | 'documentoRagId' | 'referenciaLegada'>): string | null {
  return item.documentoRagId ?? item.vagaId ?? item.referenciaLegada;
}

export function tipoDoJob(tipoLote: string): TipoJob {
  return tipoLote === TIPO_INGESTAO ? 'reindexar_contexto' : 'importar_lote';
}

@Injectable()
export class LotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async criar(usuarioId: string, tipo: string, referencias: string[]) {
    const itens = referencias.map((id) => (tipo === TIPO_INGESTAO ? { documentoRagId: id } : { vagaId: id }));
    const { lote, jobs } = await this.prisma.$transaction(async (tx) => {
      const lote = await tx.lote.create({
        data: { usuarioId, tipo, total: referencias.length, itens: { create: itens } },
        include: { itens: { select: { id: true } } },
      });
      const jobs = [];
      for (const item of lote.itens) {
        jobs.push(await this.jobs.criar(tx, { tipo: tipoDoJob(tipo), usuarioId, referenciaId: item.id }));
      }
      if (!lote.itens.length) await tx.lote.update({ where: { id: lote.id }, data: { status: 'CONCLUIDO' } });
      return { lote, jobs };
    });
    await this.jobs.enfileirar(jobs);
    const { itens: _itens, ...semItens } = lote;
    return semItens;
  }

  async status(usuarioId: string, id: string) {
    const lote = await this.prisma.lote.findFirst({
      where: { id, usuarioId },
      include: { itens: true },
    });
    if (!lote) throw new NotFoundException('lote nao encontrado');
    return {
      id: lote.id,
      tipo: lote.tipo,
      status: lote.status,
      total: lote.total,
      processados: lote.processados,
      itens: lote.itens.map((i) => ({
        id: i.id,
        bancoVagaId: referenciaDoItem(i),
        status: i.status,
        erro: i.erro,
      })),
    };
  }
}
