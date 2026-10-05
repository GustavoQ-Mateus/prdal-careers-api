import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentoRagRegistro, NotaObsidianRegistro, OrigemDocumentoRag } from './tipos';

export type NovoDocumentoRag = Omit<DocumentoRagRegistro, 'criadoEm'>;

@Injectable()
export class DocumentosRagRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async substituirPerfilECandidaturas(usuarioId: string, novos: NovoDocumentoRag[]): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.documentoRag.deleteMany({ where: { usuarioId, origem: { in: ['perfil', 'candidatura'] } } });
      if (novos.length) await tx.documentoRag.createMany({ data: novos });
      const todos = await tx.documentoRag.findMany({ where: { usuarioId }, select: { id: true }, orderBy: { criadoEm: 'asc' } });
      return todos.map((documento) => documento.id);
    });
  }

  async inserirNotas(notas: { nota: NotaObsidianRegistro; documento: NovoDocumentoRag }[]): Promise<void> {
    if (!notas.length) return;
    await this.prisma.$transaction([
      this.prisma.notaObsidian.createMany({ data: notas.map(({ nota }) => nota) }),
      this.prisma.documentoRag.createMany({ data: notas.map(({ documento }) => documento) }),
    ]);
  }

  async buscar(id: string): Promise<DocumentoRagRegistro | null> {
    return this.prisma.documentoRag.findUnique({ where: { id } });
  }

  async contar(usuarioId: string, origem?: OrigemDocumentoRag): Promise<number> {
    return this.prisma.documentoRag.count({ where: { usuarioId, ...(origem ? { origem } : {}) } });
  }
}
