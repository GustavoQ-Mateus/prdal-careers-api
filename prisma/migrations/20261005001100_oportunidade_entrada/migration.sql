CREATE TYPE "EstagioOportunidade" AS ENUM ('ENTRADA', 'ATIVA');

ALTER TABLE "vagas" ADD COLUMN "estagio" "EstagioOportunidade" NOT NULL DEFAULT 'ATIVA';

ALTER TABLE "lote_itens" ADD COLUMN "vaga_id" TEXT;

INSERT INTO "vagas" ("id", "usuario_id", "titulo", "empresa", "descricao", "fonte", "keywords", "keywords_status", "keywords_extracao", "categoria", "nivel", "origem", "estagio", "criado_em", "atualizado_em")
SELECT b."id", b."usuario_id", b."titulo", b."empresa", b."descricao", b."fonte",
       COALESCE(b."keywords", '[]'::jsonb),
       b."keywords_status",
       CASE WHEN b."keywords_status" = 'VALIDAS' AND jsonb_typeof(b."keywords") = 'array' AND jsonb_array_length(b."keywords") > 0
            THEN 'PRONTAS'::"EstadoExtracaoKeywords"
            ELSE 'PENDENTE'::"EstadoExtracaoKeywords" END,
       b."categoria", b."nivel", 'IMPORTACAO', 'ENTRADA', b."criado_em", b."criado_em"
  FROM "banco_vagas" b
 WHERE b."status" = 'CRUA'
ON CONFLICT ("id") DO NOTHING;

UPDATE "lote_itens" li
   SET "vaga_id" = CASE WHEN b."status" = 'CRUA' THEN b."id"
                        ELSE COALESCE(b."vaga_id", (SELECT v."id" FROM "vagas" v WHERE v."usuario_id" = b."usuario_id" AND v."origem_importacao_id" = b."id")) END
  FROM "banco_vagas" b
 WHERE b."id" = li."banco_vaga_id"
   AND li."vaga_id" IS NULL;

ALTER TABLE "lote_itens" DROP CONSTRAINT "lote_itens_uma_referencia_chk";

ALTER TABLE "lote_itens" DROP CONSTRAINT "lote_itens_banco_vaga_id_fkey";

DROP INDEX "lote_itens_banco_vaga_id_idx";

ALTER TABLE "lote_itens" DROP COLUMN "banco_vaga_id";

ALTER TABLE "lote_itens" ADD CONSTRAINT "lote_itens_uma_referencia_chk" CHECK (num_nonnulls("vaga_id", "documento_rag_id") <= 1);

DROP TABLE "banco_vagas";

DROP TYPE "StatusBancoVaga";

CREATE INDEX "lote_itens_vaga_id_idx" ON "lote_itens"("vaga_id");

CREATE INDEX "vagas_usuario_id_estagio_criado_em_idx" ON "vagas"("usuario_id", "estagio", "criado_em" DESC);

ALTER TABLE "lote_itens" ADD CONSTRAINT "lote_itens_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
