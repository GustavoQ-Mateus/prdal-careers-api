-- v1.5 oportunidade: campos aditivos, acoes, eventos, layout, geracoes e indices parciais

ALTER TABLE vagas
  ADD COLUMN IF NOT EXISTS prioridade "PrioridadeOportunidade" NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN IF NOT EXISTS origem "OrigemOportunidade" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS origem_importacao_id TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS arquivada_em TIMESTAMP(3);

ALTER TABLE candidaturas
  ADD COLUMN IF NOT EXISTS principal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviada_em TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS encerrada_em TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS motivo_encerramento TEXT,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS candidaturas_vaga_principal_uidx
  ON candidaturas (vaga_id)
  WHERE principal = true;

CREATE UNIQUE INDEX IF NOT EXISTS acoes_principal_pendente_uidx
  ON acoes_oportunidade (vaga_id)
  WHERE principal = true AND concluida_em IS NULL AND cancelada_em IS NULL;
