import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EventosService } from '../eventos/eventos.service';
import { JobsService } from '../jobs/jobs.service';
import { LotesService } from '../lotes/lotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { BancoVagasRepositorio } from '../repositorios/banco-vagas.repositorio';
import { BancoVagaRegistro } from '../repositorios/tipos';
import { ImportarBancoVagasDto } from './banco-vaga.dto';

@Injectable()
export class BancoVagasService {
  constructor(
    private readonly bancoVagas: BancoVagasRepositorio,
    private readonly prisma: PrismaService,
    private readonly lotes: LotesService,
    private readonly eventos: EventosService,
    private readonly jobs: JobsService,
  ) {}

  async importar(usuarioId: string, dto: ImportarBancoVagasDto) {
    const docs: Omit<BancoVagaRegistro, 'criadoEm'>[] = dto.itens.map((item) => ({
      id: randomUUID(),
      usuarioId,
      titulo: item.titulo,
      empresa: item.empresa,
      fonte: item.fonte ?? null,
      descricao: item.descricao,
      status: 'CRUA',
      categoria: null,
      nivel: null,
      keywords: null,
      keywordsStatus: 'PENDENTE',
      vagaId: null,
    }));
    await this.bancoVagas.inserir(docs);

    const lote = await this.lotes.criar(
      usuarioId,
      'IMPORTACAO',
      docs.map((d) => d.id),
    );
    return { loteId: lote.id, total: docs.length };
  }

  async listar(usuarioId: string) {
    const docs = await this.bancoVagas.listar(usuarioId);
    return docs.map((d) => ({
      id: d.id,
      titulo: d.titulo,
      empresa: d.empresa,
      fonte: d.fonte,
      categoria: d.categoria,
      nivel: d.nivel,
      keywords: d.keywords,
      keywordsStatus: d.keywordsStatus,
      status: d.status,
      criadoEm: d.criadoEm,
    }));
  }

  async ativar(usuarioId: string, id: string) {
    const existente = await this.prisma.vaga.findFirst({
      where: { usuarioId, origemImportacaoId: id },
    });
    if (existente) {
      await this.bancoVagas.marcarAtivada(id, usuarioId, existente.id);
      return existente;
    }

    const doc = await this.bancoVagas.buscar(id, usuarioId);
    if (!doc) throw new NotFoundException('postagem nao encontrada');

    const prontas = doc.keywordsStatus === 'VALIDAS' && Array.isArray(doc.keywords) && doc.keywords.length > 0;
    const { vaga, job } = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.vaga.create({
        data: {
          usuarioId,
          titulo: doc.titulo,
          empresa: doc.empresa,
          descricao: doc.descricao,
          fonte: doc.fonte,
          keywords: (doc.keywords ?? []) as unknown as Prisma.InputJsonValue,
          keywordsStatus: prontas ? 'VALIDAS' : 'PENDENTE',
          keywordsExtracao: prontas ? 'PRONTAS' : 'PENDENTE',
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
      const job = prontas ? null : await this.jobs.criar(tx, { tipo: 'extrair_keywords', usuarioId, referenciaId: criada.id });
      return { vaga: criada, job };
    });
    if (job) await this.jobs.enfileirar([job]);

    await this.bancoVagas.marcarAtivada(id, usuarioId, vaga.id);
    return vaga;
  }
}
