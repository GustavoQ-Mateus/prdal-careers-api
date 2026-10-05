CREATE TYPE "TipoJob" AS ENUM ('gerar_curriculo', 'extrair_keywords', 'importar_lote', 'reindexar_contexto');

CREATE TYPE "StatusJob" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO');

CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "tipo" "TipoJob" NOT NULL,
    "status" "StatusJob" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "locked_by" TEXT,
    "erro" TEXT,
    "entrada" JSONB,
    "resultado" JSONB,
    "usuario_id" TEXT NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "request_id" TEXT,
    "enfileirado_em" TIMESTAMP(3),
    "iniciado_em" TIMESTAMP(3),
    "concluido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "jobs_status_criado_em_idx" ON "jobs"("status", "criado_em");

CREATE INDEX "jobs_tipo_referencia_id_idx" ON "jobs"("tipo", "referencia_id");

CREATE INDEX "jobs_usuario_id_idx" ON "jobs"("usuario_id");

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

