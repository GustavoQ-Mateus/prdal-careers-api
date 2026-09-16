import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EventosService } from '../eventos/eventos.service';
import { BancoVagaDoc, MongoService } from '../mongo/mongo.service';
import { LotesService } from '../lotes/lotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ImportarBancoVagasDto } from './banco-vaga.dto';

@Injectable()
export class BancoVagasService {
  constructor(
    private readonly mongo: MongoService,
    private readonly prisma: PrismaService,
    private readonly lotes: LotesService,
    private readonly eventos: EventosService,
  ) {}

  async importar(usuarioId: string, dto: ImportarBancoVagasDto) {
    const docs: BancoVagaDoc[] = dto.itens.map((item) => ({
      _id: randomUUID(),
      usuarioId,
      titulo: item.titulo,
      empresa: item.empresa,
      fonte: item.fonte ?? null,
      descricao: item.descricao,
      status: 'CRUA',
      categoria: null,
      nivel: null,
      keywords: null,
      criadoEm: new Date(),
    }));
    await this.mongo.bancoVagas().insertMany(docs);

    const lote = await this.lotes.criar(
      usuarioId,
      'IMPORTACAO',
      docs.map((d) => d._id),
    );
    return { loteId: lote.id, total: docs.length };
  }

  async listar(usuarioId: string) {
    const docs = await this.mongo
      .bancoVagas()
      .find({ usuarioId })
      .sort({ criadoEm: -1 })
      .toArray();
    return docs.map((d) => ({
      id: d._id,
      titulo: d.titulo,
      empresa: d.empresa,
      fonte: d.fonte,
      categoria: d.categoria,
      nivel: d.nivel,
      keywords: d.keywords,
      status: d.status,
      criadoEm: d.criadoEm,
    }));
  }

  async ativar(usuarioId: string, id: string) {
    const existente = await this.prisma.vaga.findFirst({
      where: { usuarioId, origemImportacaoId: id },
    });
    if (existente) {
      await this.mongo.bancoVagas().updateOne(
        { _id: id, usuarioId },
        { $set: { status: 'ATIVADA', origemRelacionalId: existente.id } },
      );
      return existente;
    }

    const doc = await this.mongo.bancoVagas().findOne({ _id: id, usuarioId });
    if (!doc) throw new NotFoundException('postagem nao encontrada');

    const vaga = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.vaga.create({
        data: {
          usuarioId,
          titulo: doc.titulo,
          empresa: doc.empresa,
          descricao: doc.descricao,
          fonte: doc.fonte,
          keywords: (doc.keywords ?? []) as unknown as Prisma.InputJsonValue,
          categoria: doc.categoria,
          nivel: doc.nivel,
          origem: 'IMPORTACAO',
          origemImportacaoId: id,
        },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: criada.id,
        tipo: 'OPORTUNIDADE_ATIVADA',
        origem: 'SISTEMA',
        descricao: 'Entrada ativada',
        dados: { entradaId: id },
      });
      return criada;
    });

    await this.mongo.bancoVagas().updateOne(
      { _id: id, usuarioId },
      { $set: { status: 'ATIVADA', origemRelacionalId: vaga.id } },
    );
    return vaga;
  }
}
