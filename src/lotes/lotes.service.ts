import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { LoteItem } from '@prisma/client';
import { AiClient } from '../clients/ai.client';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma/prisma.service';

const CONCORRENCIA = Number(process.env.BATCH_CONCURRENCY ?? 3);
const MAX_TENTATIVAS = 3;

@Injectable()
export class LotesService implements OnModuleInit {
  private readonly logger = new Logger(LotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly ai: AiClient,
  ) {}

  async onModuleInit() {
    await this.prisma.loteItem.updateMany({
      where: { status: 'PROCESSANDO' },
      data: { status: 'PENDENTE' },
    });
    const inacabados = await this.prisma.lote.findMany({
      where: { status: { not: 'CONCLUIDO' } },
      select: { id: true },
    });
    setTimeout(() => {
      for (const lote of inacabados) {
        void this.processar(lote.id).catch((err) =>
          this.logger.error(`retomada do lote ${lote.id}: ${err.message}`),
        );
      }
    }, 3000);
  }

  async criar(usuarioId: string, tipo: string, bancoVagaIds: string[]) {
    const lote = await this.prisma.lote.create({
      data: {
        usuarioId,
        tipo,
        total: bancoVagaIds.length,
        itens: { create: bancoVagaIds.map((id) => ({ bancoVagaId: id })) },
      },
    });
    void this.processar(lote.id).catch((err) =>
      this.logger.error(`processamento do lote ${lote.id}: ${err.message}`),
    );
    return lote;
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
        bancoVagaId: i.bancoVagaId,
        status: i.status,
        erro: i.erro,
      })),
    };
  }

  private async processar(loteId: string) {
    const lote = await this.prisma.lote.findUnique({ where: { id: loteId } });
    if (!lote || lote.status === 'CONCLUIDO') return;
    await this.prisma.lote.update({
      where: { id: loteId },
      data: { status: 'PROCESSANDO' },
    });

    const pendentes = await this.prisma.loteItem.findMany({
      where: { loteId, status: 'PENDENTE' },
    });
    const acao =
      lote.tipo === 'INGESTAO'
        ? (ref: string) => this.indexarDocumento(ref)
        : (ref: string) => this.processarBancoVaga(ref);
    await this.executarComConcorrencia(pendentes, CONCORRENCIA, (item) =>
      this.processarItem(item, acao),
    );

    const restantes = await this.prisma.loteItem.count({
      where: { loteId, status: 'PENDENTE' },
    });
    if (restantes === 0) {
      await this.prisma.lote.update({
        where: { id: loteId },
        data: { status: 'CONCLUIDO' },
      });
    }
  }

  private async processarItem(
    item: LoteItem,
    acao: (ref: string) => Promise<void>,
  ) {
    await this.prisma.loteItem.update({
      where: { id: item.id },
      data: { status: 'PROCESSANDO' },
    });
    let tentativas = item.tentativas;
    let ultimoErro = '';
    while (tentativas < MAX_TENTATIVAS) {
      tentativas += 1;
      try {
        await acao(item.bancoVagaId);
        await this.prisma.loteItem.update({
          where: { id: item.id },
          data: { status: 'CONCLUIDO', tentativas },
        });
        await this.prisma.lote.update({
          where: { id: item.loteId },
          data: { processados: { increment: 1 } },
        });
        return;
      } catch (err) {
        ultimoErro = (err as Error).message;
      }
    }
    await this.prisma.loteItem.update({
      where: { id: item.id },
      data: { status: 'ERRO', tentativas, erro: ultimoErro },
    });
  }

  private async processarBancoVaga(bancoVagaId: string) {
    const doc = await this.mongo.bancoVagas().findOne({ _id: bancoVagaId });
    if (!doc) throw new Error('postagem nao encontrada no banco de vagas');
    const extracao = await this.ai.keywords(doc.descricao);
    const { categoria, nivel } = await this.ai.classify(doc.titulo, doc.descricao);
    await this.mongo
      .bancoVagas()
      .updateOne(
        { _id: bancoVagaId },
        { $set: { keywords: extracao.keywords, keywordsStatus: extracao.status, categoria, nivel } },
      );
  }

  private async indexarDocumento(documentoId: string) {
    const doc = await this.mongo.documentosRag().findOne({ _id: documentoId });
    if (!doc) throw new Error('documento nao encontrado');
    await this.ai.contextIngest([
      {
        usuarioId: doc.usuarioId,
        origem: doc.origem,
        origemId: doc.origemId,
        titulo: doc.titulo,
        texto: doc.texto,
      },
    ]);
  }

  private async executarComConcorrencia<T>(
    itens: T[],
    limite: number,
    fn: (item: T) => Promise<void>,
  ) {
    let indice = 0;
    const trabalhador = async () => {
      while (indice < itens.length) {
        const atual = itens[indice++];
        await fn(atual);
      }
    };
    const trabalhadores = Array.from(
      { length: Math.min(limite, itens.length) },
      trabalhador,
    );
    await Promise.all(trabalhadores);
  }
}
