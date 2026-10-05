import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const DIMENSAO_PADRAO = 384;

export function dimensaoConfigurada(): number {
  const valor = Number(process.env.EMBED_DIMENSAO);
  return Number.isInteger(valor) && valor > 0 ? valor : DIMENSAO_PADRAO;
}

export interface ChunkParaGravar {
  indice: number;
  fonteId: string;
  texto: string;
  vetor: number[];
}

export interface ChunkEncontrado {
  consulta: number;
  fonteId: string;
  texto: string;
  tipo: string;
  factual: boolean;
  titulo: string;
  origem: string;
  similaridade: number;
}

export class DimensaoIncompativel extends Error {}

function literalVetor(vetor: number[]): string {
  if (!vetor.every((valor) => Number.isFinite(valor))) throw new DimensaoIncompativel('vetor com valor nao numerico');
  return `[${vetor.join(',')}]`;
}

@Injectable()
export class VetoresRepositorio implements OnModuleInit {
  private dimensao: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.conferirDimensao();
  }

  async conferirDimensao(): Promise<number> {
    const linhas = await this.prisma.$queryRaw<{ dimensao: number }[]>`
      SELECT atttypmod AS dimensao FROM pg_attribute
       WHERE attrelid = 'chunks_rag'::regclass AND attname = 'embedding'`;
    const coluna = Number(linhas[0]?.dimensao);
    const configurada = dimensaoConfigurada();
    if (coluna !== configurada) {
      throw new DimensaoIncompativel(
        `a coluna chunks_rag.embedding tem ${coluna} dimensoes e EMBED_DIMENSAO pede ${configurada}; trocar de modelo exige migrar a coluna e reindexar`,
      );
    }
    this.dimensao = coluna;
    return coluna;
  }

  async exigirDimensao(dimensao: number): Promise<void> {
    const coluna = this.dimensao ?? (await this.conferirDimensao());
    if (dimensao !== coluna) {
      throw new DimensaoIncompativel(`o embedding veio com ${dimensao} dimensoes e o banco guarda ${coluna}`);
    }
  }

  async substituir(documentoId: string, usuarioId: string, modelo: string, chunks: ChunkParaGravar[]): Promise<void> {
    const linhas = chunks.map(
      (chunk) => Prisma.sql`(${randomUUID()}, ${documentoId}, ${usuarioId}, ${chunk.indice}, ${chunk.fonteId}, ${chunk.texto}, ${modelo}, ${literalVetor(chunk.vetor)}::vector)`,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.chunkRag.deleteMany({ where: { documentoId } });
      if (!linhas.length) return;
      await tx.$executeRaw`
        INSERT INTO chunks_rag (id, documento_id, usuario_id, indice, fonte_id, texto, modelo, embedding)
        VALUES ${Prisma.join(linhas)}`;
    });
  }

  async buscar(usuarioId: string, modelo: string, vetores: number[][], porConsulta: number): Promise<ChunkEncontrado[]> {
    if (!vetores.length) return [];
    const literais = vetores.map(literalVetor);
    const linhas = await this.prisma.$queryRaw<(Omit<ChunkEncontrado, 'consulta'> & { consulta: bigint })[]>`
      SELECT q.n AS consulta, r.*
        FROM unnest(${literais}::text[]) WITH ORDINALITY AS q(v, n)
       CROSS JOIN LATERAL (
         SELECT c.fonte_id AS "fonteId",
                c.texto,
                d.tipo::text AS tipo,
                d.factual,
                d.titulo,
                d.origem::text AS origem,
                1 - (c.embedding <=> q.v::vector) AS similaridade
           FROM chunks_rag c
           JOIN documentos_rag d ON d.id = c.documento_id
          WHERE c.usuario_id = ${usuarioId} AND c.modelo = ${modelo}
          ORDER BY c.embedding <=> q.v::vector
          LIMIT ${porConsulta}
       ) r
       ORDER BY q.n, r.similaridade DESC`;
    return linhas.map((linha) => ({ ...linha, consulta: Number(linha.consulta), similaridade: Number(linha.similaridade) }));
  }

  async contarDeOutroModelo(usuarioId: string, modelo: string): Promise<number> {
    return this.prisma.chunkRag.count({ where: { usuarioId, modelo: { not: modelo } } });
  }
}
