CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "PrioridadeOportunidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

CREATE TYPE "OrigemOportunidade" AS ENUM ('MANUAL', 'IMPORTACAO');

CREATE TYPE "StatusKeywords" AS ENUM ('VALIDAS', 'PENDENTE');

CREATE TYPE "StatusCandidatura" AS ENUM ('RASCUNHO', 'INSCRITA', 'EM_PROCESSO', 'ENTREVISTA', 'OFERTA', 'REJEITADA', 'DESISTIU');

CREATE TYPE "StatusLote" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO');

CREATE TYPE "StatusLoteItem" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO');

CREATE TYPE "TipoAcaoOportunidade" AS ENUM ('REVISAR_VAGA', 'GERAR_CURRICULO', 'ENVIAR_CANDIDATURA', 'FAZER_FOLLOW_UP', 'PREPARAR_ENTREVISTA', 'PARTICIPAR_ENTREVISTA', 'ENVIAR_MATERIAL', 'OUTRO');

CREATE TYPE "OrigemEvento" AS ENUM ('SISTEMA', 'USUARIO');

CREATE TYPE "StatusGeracaoCurriculo" AS ENUM ('PENDENTE', 'ANALISANDO', 'GERANDO', 'VALIDANDO', 'CONCLUIDA', 'ERRO');

CREATE TYPE "EstadoPipelineAts" AS ENUM ('SEM_ANALISE', 'ANALISADA', 'AGUARDANDO_CONFIRMACAO', 'GERANDO', 'CONCLUIDA', 'FALHOU', 'DESATUALIZADA');

CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uso_tokens_diario" (
    "usuario_id" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "entrada" INTEGER NOT NULL DEFAULT 0,
    "saida" INTEGER NOT NULL DEFAULT 0,
    "cache_lida" INTEGER NOT NULL DEFAULT 0,
    "cache_escrita" INTEGER NOT NULL DEFAULT 0,
    "chamadas" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uso_tokens_diario_pkey" PRIMARY KEY ("usuario_id","dia")
);

CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "ultimo_uso_em" TIMESTAMP(3),
    "substituida_em" TIMESTAMP(3),
    "revogada_em" TIMESTAMP(3),

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "perfil_mestre" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contato" JSONB NOT NULL,
    "resumo" TEXT NOT NULL,
    "experiencias" JSONB NOT NULL,
    "formacao" JSONB NOT NULL,
    "certificacoes" JSONB NOT NULL DEFAULT '[]',
    "idiomas" JSONB NOT NULL DEFAULT '[]',
    "skills" JSONB NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_mestre_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vagas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "fonte" TEXT,
    "keywords" JSONB NOT NULL,
    "keywords_status" "StatusKeywords" NOT NULL DEFAULT 'PENDENTE',
    "categoria" TEXT,
    "nivel" TEXT,
    "prioridade" "PrioridadeOportunidade" NOT NULL DEFAULT 'MEDIA',
    "origem" "OrigemOportunidade" NOT NULL DEFAULT 'MANUAL',
    "origem_importacao_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivada_em" TIMESTAMP(3),

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculos" (
    "id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL DEFAULT 'Versao 1',
    "markdown" TEXT NOT NULL,
    "docx_path" TEXT,
    "pdf_path" TEXT,
    "score" INTEGER,
    "score_breakdown" JSONB,
    "analise_inicial" JSONB,
    "analise_final" JSONB,
    "degradacao" TEXT,
    "modelo" TEXT,
    "prompt_version" TEXT,
    "estrutura" JSONB,
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidaturas" (
    "id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "curriculo_id" TEXT,
    "status" "StatusCandidatura" NOT NULL DEFAULT 'RASCUNHO',
    "notas" TEXT NOT NULL DEFAULT '',
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "enviada_em" TIMESTAMP(3),
    "encerrada_em" TIMESTAMP(3),
    "motivo_encerramento" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lotes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'PENDENTE',
    "total" INTEGER NOT NULL,
    "processados" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lote_itens" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "banco_vaga_id" TEXT NOT NULL,
    "status" "StatusLoteItem" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,

    CONSTRAINT "lote_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acoes_oportunidade" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "candidatura_id" TEXT,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoAcaoOportunidade" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "vence_em" TIMESTAMP(3),
    "lembrar_em" TIMESTAMP(3),
    "concluida_em" TIMESTAMP(3),
    "cancelada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acoes_oportunidade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eventos_oportunidade" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "candidatura_id" TEXT,
    "curriculo_id" TEXT,
    "tipo" TEXT NOT NULL,
    "origem" "OrigemEvento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_oportunidade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_layouts" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "pos_x" DOUBLE PRECISION NOT NULL,
    "pos_y" DOUBLE PRECISION NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_layouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "preferencias_usuario" (
    "usuario_id" TEXT NOT NULL,
    "fuso_horario" TEXT NOT NULL,
    "canvas_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "canvas_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "canvas_zoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "canvas_revisao" INTEGER NOT NULL DEFAULT 1,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferencias_usuario_pkey" PRIMARY KEY ("usuario_id")
);

CREATE TABLE "geracoes_curriculo" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "curriculo_id" TEXT,
    "status" "StatusGeracaoCurriculo" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "analise_inicial" JSONB,
    "analise_final" JSONB,
    "degradacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geracoes_curriculo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipelines_ats" (
    "vaga_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "estado" "EstadoPipelineAts" NOT NULL,
    "job_id" TEXT,
    "curriculo_id" TEXT,
    "perfil_alterado_na_geracao" BOOLEAN NOT NULL DEFAULT false,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipelines_ats_pkey" PRIMARY KEY ("vaga_id")
);

CREATE TABLE "eventos_pipeline_ats" (
    "id" TEXT NOT NULL,
    "vaga_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "de" "EstadoPipelineAts" NOT NULL,
    "para" "EstadoPipelineAts" NOT NULL,
    "job_id" TEXT,
    "dados" JSONB NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pipeline_ats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

CREATE UNIQUE INDEX "sessoes_refresh_hash_key" ON "sessoes"("refresh_hash");

CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

CREATE INDEX "sessoes_familia_idx" ON "sessoes"("familia");

CREATE UNIQUE INDEX "perfil_mestre_usuario_id_key" ON "perfil_mestre"("usuario_id");

CREATE UNIQUE INDEX "vagas_usuario_id_origem_importacao_id_key" ON "vagas"("usuario_id", "origem_importacao_id");

CREATE INDEX "acoes_oportunidade_usuario_id_vence_em_idx" ON "acoes_oportunidade"("usuario_id", "vence_em");

CREATE INDEX "eventos_oportunidade_usuario_id_vaga_id_ocorrido_em_idx" ON "eventos_oportunidade"("usuario_id", "vaga_id", "ocorrido_em");

CREATE UNIQUE INDEX "pipeline_layouts_usuario_id_vaga_id_modo_key" ON "pipeline_layouts"("usuario_id", "vaga_id", "modo");

CREATE INDEX "pipelines_ats_usuario_id_estado_idx" ON "pipelines_ats"("usuario_id", "estado");

CREATE INDEX "eventos_pipeline_ats_vaga_id_ocorrido_em_idx" ON "eventos_pipeline_ats"("vaga_id", "ocorrido_em");

CREATE INDEX "eventos_pipeline_ats_usuario_id_job_id_idx" ON "eventos_pipeline_ats"("usuario_id", "job_id");

ALTER TABLE "uso_tokens_diario" ADD CONSTRAINT "uso_tokens_diario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "perfil_mestre" ADD CONSTRAINT "perfil_mestre_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vagas" ADD CONSTRAINT "vagas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "curriculos" ADD CONSTRAINT "curriculos_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_curriculo_id_fkey" FOREIGN KEY ("curriculo_id") REFERENCES "curriculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lotes" ADD CONSTRAINT "lotes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lote_itens" ADD CONSTRAINT "lote_itens_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acoes_oportunidade" ADD CONSTRAINT "acoes_oportunidade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acoes_oportunidade" ADD CONSTRAINT "acoes_oportunidade_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acoes_oportunidade" ADD CONSTRAINT "acoes_oportunidade_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "eventos_oportunidade" ADD CONSTRAINT "eventos_oportunidade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_oportunidade" ADD CONSTRAINT "eventos_oportunidade_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_oportunidade" ADD CONSTRAINT "eventos_oportunidade_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "eventos_oportunidade" ADD CONSTRAINT "eventos_oportunidade_curriculo_id_fkey" FOREIGN KEY ("curriculo_id") REFERENCES "curriculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pipeline_layouts" ADD CONSTRAINT "pipeline_layouts_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pipeline_layouts" ADD CONSTRAINT "pipeline_layouts_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "preferencias_usuario" ADD CONSTRAINT "preferencias_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "geracoes_curriculo" ADD CONSTRAINT "geracoes_curriculo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "geracoes_curriculo" ADD CONSTRAINT "geracoes_curriculo_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "geracoes_curriculo" ADD CONSTRAINT "geracoes_curriculo_curriculo_id_fkey" FOREIGN KEY ("curriculo_id") REFERENCES "curriculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pipelines_ats" ADD CONSTRAINT "pipelines_ats_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pipelines_ats" ADD CONSTRAINT "pipelines_ats_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_pipeline_ats" ADD CONSTRAINT "eventos_pipeline_ats_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "pipelines_ats"("vaga_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "candidaturas_vaga_principal_uidx" ON "candidaturas"("vaga_id") WHERE "principal" = true;

CREATE UNIQUE INDEX "acoes_principal_pendente_uidx" ON "acoes_oportunidade"("vaga_id") WHERE "principal" = true AND "concluida_em" IS NULL AND "cancelada_em" IS NULL;
