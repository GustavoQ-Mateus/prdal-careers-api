ALTER TABLE "usuarios" ADD COLUMN "consentimento_llm_em" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN "exclusao_agendada_para" TIMESTAMP(3);

ALTER TYPE "TipoJob" ADD VALUE 'exportar_dados';
ALTER TYPE "TipoJob" ADD VALUE 'excluir_conta';
