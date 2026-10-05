ALTER TYPE "TipoJob" ADD VALUE 'sincronizar_lembrete';

ALTER TABLE "acoes_oportunidade" ADD COLUMN "lembrete_enviado_em" TIMESTAMP(3);

CREATE INDEX "acoes_oportunidade_lembrar_em_lembrete_enviado_em_idx" ON "acoes_oportunidade"("lembrar_em", "lembrete_enviado_em");
