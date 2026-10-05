CREATE TYPE "EstadoExtracaoKeywords" AS ENUM ('PENDENTE', 'EXTRAINDO', 'PRONTAS', 'ERRO');

ALTER TYPE "TipoJob" ADD VALUE 'empacotar_curriculo';

ALTER TABLE "vagas" ADD COLUMN     "keywords_erro" TEXT,
ADD COLUMN     "keywords_extracao" "EstadoExtracaoKeywords" NOT NULL DEFAULT 'PENDENTE';

UPDATE "vagas" SET "keywords_extracao" = 'PRONTAS' WHERE "keywords_status" = 'VALIDAS';

UPDATE "vagas" SET "keywords_extracao" = 'ERRO', "keywords_erro" = 'A extração de keywords desta oportunidade não terminou. Use reprocessar keywords para tentar de novo.' WHERE "keywords_status" = 'PENDENTE';
