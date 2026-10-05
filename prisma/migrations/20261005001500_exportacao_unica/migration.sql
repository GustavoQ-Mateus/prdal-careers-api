CREATE UNIQUE INDEX "jobs_exportacao_ativa_usuario_idx" ON "jobs"("usuario_id") WHERE "tipo" = 'exportar_dados' AND "status" IN ('PENDENTE', 'PROCESSANDO');
