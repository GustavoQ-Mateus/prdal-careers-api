ALTER TABLE curriculos
  ADD COLUMN IF NOT EXISTS analise_inicial JSONB,
  ADD COLUMN IF NOT EXISTS analise_final JSONB,
  ADD COLUMN IF NOT EXISTS degradacao TEXT;

ALTER TABLE geracoes_curriculo
  ADD COLUMN IF NOT EXISTS analise_inicial JSONB,
  ADD COLUMN IF NOT EXISTS analise_final JSONB,
  ADD COLUMN IF NOT EXISTS degradacao TEXT;
