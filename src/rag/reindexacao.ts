import { PrismaService } from '../prisma/prisma.service';
import { RagService } from './rag.service';

export interface ResultadoReindexacao {
  modelo: string;
  documentos: number;
  reindexados: number;
  chunks: number;
  falhas: { documentoId: string; motivo: string }[];
}

export async function reindexarDesatualizados(
  prisma: PrismaService,
  rag: RagService,
  opcoes: { todos?: boolean; usuarioId?: string } = {},
): Promise<ResultadoReindexacao> {
  const modelo = await rag.modeloAtual();
  const documentos = await prisma.documentoRag.findMany({
    where: {
      ...(opcoes.usuarioId ? { usuarioId: opcoes.usuarioId } : {}),
      ...(opcoes.todos ? {} : { OR: [{ chunks: { none: { modelo } } }, { chunks: { some: { modelo: { not: modelo } } } }] }),
    },
    orderBy: { criadoEm: 'asc' },
  });
  const resultado: ResultadoReindexacao = { modelo, documentos: documentos.length, reindexados: 0, chunks: 0, falhas: [] };
  for (const documento of documentos) {
    try {
      resultado.chunks += await rag.indexar(documento);
      resultado.reindexados += 1;
    } catch (err) {
      resultado.falhas.push({ documentoId: documento.id, motivo: (err as Error).message });
    }
  }
  return resultado;
}
