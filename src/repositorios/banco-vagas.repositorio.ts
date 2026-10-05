import { Injectable } from '@nestjs/common';
import { BancoVaga, Prisma } from '@prisma/client';
import type { Keyword, KeywordStatus } from '../clients/ai.client';
import { PrismaService } from '../prisma/prisma.service';
import { BancoVagaRegistro } from './tipos';

export interface FiltroEntradas {
  busca?: string;
  categoria?: string;
  nivel?: string;
  limit?: number;
  offset?: number;
}

function literal(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

function registro(linha: BancoVaga): BancoVagaRegistro {
  return { ...linha, keywords: (linha.keywords as unknown as Keyword[] | null) ?? null };
}

@Injectable()
export class BancoVagasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async inserir(registros: Omit<BancoVagaRegistro, 'criadoEm'>[]): Promise<void> {
    if (!registros.length) return;
    await this.prisma.bancoVaga.createMany({
      data: registros.map((r) => ({
        ...r,
        keywords: r.keywords === null ? Prisma.DbNull : (r.keywords as unknown as Prisma.InputJsonValue),
      })),
    });
  }

  async listar(usuarioId: string): Promise<BancoVagaRegistro[]> {
    const linhas = await this.prisma.bancoVaga.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } });
    return linhas.map(registro);
  }

  async listarEntradas(usuarioId: string, filtro: FiltroEntradas): Promise<{ itens: BancoVagaRegistro[]; total: number | null }> {
    const where: Prisma.BancoVagaWhereInput = {
      usuarioId,
      status: 'CRUA',
      ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
      ...(filtro.nivel ? { nivel: filtro.nivel } : {}),
      ...(filtro.busca
        ? {
            OR: [
              { titulo: { contains: literal(filtro.busca), mode: 'insensitive' } },
              { empresa: { contains: literal(filtro.busca), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const paginar = filtro.limit !== undefined;
    const [total, linhas] = await Promise.all([
      paginar ? this.prisma.bancoVaga.count({ where }) : Promise.resolve(null),
      this.prisma.bancoVaga.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        ...(paginar ? { skip: filtro.offset ?? 0, take: filtro.limit } : {}),
      }),
    ]);
    return { itens: linhas.map(registro), total };
  }

  async buscar(id: string, usuarioId?: string): Promise<BancoVagaRegistro | null> {
    const linha = await this.prisma.bancoVaga.findFirst({ where: { id, ...(usuarioId ? { usuarioId } : {}) } });
    return linha ? registro(linha) : null;
  }

  async marcarAtivada(id: string, usuarioId: string, vagaId: string): Promise<void> {
    await this.prisma.bancoVaga.updateMany({ where: { id, usuarioId }, data: { status: 'ATIVADA', vagaId } });
  }

  async registrarExtracao(
    id: string,
    extracao: { keywords: Keyword[]; keywordsStatus: KeywordStatus; categoria: string; nivel: string },
  ): Promise<void> {
    await this.prisma.bancoVaga.update({
      where: { id },
      data: { ...extracao, keywords: extracao.keywords as unknown as Prisma.InputJsonValue },
    });
  }
}
