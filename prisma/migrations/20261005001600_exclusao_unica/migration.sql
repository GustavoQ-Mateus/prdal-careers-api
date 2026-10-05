CREATE UNIQUE INDEX "jobs_exclusao_ativa_usuario_idx" ON "jobs"("usuario_id") WHERE "tipo" = 'excluir_conta' AND "status" IN ('PENDENTE', 'PROCESSANDO');
