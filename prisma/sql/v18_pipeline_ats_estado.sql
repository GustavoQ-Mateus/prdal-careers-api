DO $$ BEGIN
  CREATE TYPE "EstadoPipelineAts" AS ENUM (
    'SEM_ANALISE', 'ANALISADA', 'AGUARDANDO_CONFIRMACAO', 'GERANDO', 'CONCLUIDA', 'FALHOU', 'DESATUALIZADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pipelines_ats (
  vaga_id TEXT PRIMARY KEY REFERENCES vagas(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado "EstadoPipelineAts" NOT NULL,
  job_id TEXT,
  curriculo_id TEXT,
  perfil_alterado_na_geracao BOOLEAN NOT NULL DEFAULT false,
  versao INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS pipelines_ats_usuario_id_estado_idx ON pipelines_ats (usuario_id, estado);

CREATE TABLE IF NOT EXISTS eventos_pipeline_ats (
  id TEXT PRIMARY KEY,
  vaga_id TEXT NOT NULL REFERENCES pipelines_ats(vaga_id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  de "EstadoPipelineAts" NOT NULL,
  para "EstadoPipelineAts" NOT NULL,
  job_id TEXT,
  dados JSONB NOT NULL,
  ocorrido_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS eventos_pipeline_ats_vaga_id_ocorrido_em_idx ON eventos_pipeline_ats (vaga_id, ocorrido_em);
CREATE INDEX IF NOT EXISTS eventos_pipeline_ats_usuario_id_job_id_idx ON eventos_pipeline_ats (usuario_id, job_id);
