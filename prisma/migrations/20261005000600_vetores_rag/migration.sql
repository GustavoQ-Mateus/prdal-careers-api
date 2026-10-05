CREATE TABLE "chunks_rag" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "indice" INTEGER NOT NULL,
    "fonte_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_rag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chunks_rag_usuario_id_modelo_idx" ON "chunks_rag"("usuario_id", "modelo");

CREATE UNIQUE INDEX "chunks_rag_documento_id_indice_key" ON "chunks_rag"("documento_id", "indice");

ALTER TABLE "chunks_rag" ADD CONSTRAINT "chunks_rag_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_rag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chunks_rag" ADD CONSTRAINT "chunks_rag_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

