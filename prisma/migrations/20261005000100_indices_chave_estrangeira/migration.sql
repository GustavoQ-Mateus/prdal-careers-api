CREATE INDEX "curriculos_vaga_id_idx" ON "curriculos"("vaga_id");

CREATE INDEX "candidaturas_vaga_id_idx" ON "candidaturas"("vaga_id");

CREATE INDEX "candidaturas_curriculo_id_idx" ON "candidaturas"("curriculo_id");

CREATE INDEX "lotes_usuario_id_idx" ON "lotes"("usuario_id");

CREATE INDEX "lote_itens_lote_id_idx" ON "lote_itens"("lote_id");

CREATE INDEX "acoes_oportunidade_vaga_id_idx" ON "acoes_oportunidade"("vaga_id");

CREATE INDEX "acoes_oportunidade_candidatura_id_idx" ON "acoes_oportunidade"("candidatura_id");

CREATE INDEX "eventos_oportunidade_vaga_id_idx" ON "eventos_oportunidade"("vaga_id");

CREATE INDEX "eventos_oportunidade_candidatura_id_idx" ON "eventos_oportunidade"("candidatura_id");

CREATE INDEX "eventos_oportunidade_curriculo_id_idx" ON "eventos_oportunidade"("curriculo_id");

CREATE INDEX "pipeline_layouts_vaga_id_idx" ON "pipeline_layouts"("vaga_id");

CREATE INDEX "geracoes_curriculo_usuario_id_idx" ON "geracoes_curriculo"("usuario_id");

CREATE INDEX "geracoes_curriculo_vaga_id_idx" ON "geracoes_curriculo"("vaga_id");

CREATE INDEX "geracoes_curriculo_curriculo_id_idx" ON "geracoes_curriculo"("curriculo_id");
