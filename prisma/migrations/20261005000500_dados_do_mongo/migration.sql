CREATE TYPE "ModoConversaCopiloto" AS ENUM ('assistido', 'autopiloto');

CREATE TYPE "PapelMensagemCopiloto" AS ENUM ('user', 'assistant', 'tool', 'evento');

CREATE TYPE "OrigemDocumentoRag" AS ENUM ('perfil', 'candidatura', 'nota');

CREATE TYPE "TipoDocumentoRag" AS ENUM ('experiencia', 'resumo', 'skills', 'formacao', 'certificacao', 'idiomas', 'nota', 'candidatura');

CREATE TYPE "StatusBancoVaga" AS ENUM ('CRUA', 'ATIVADA');

ALTER TABLE "lote_itens" RENAME COLUMN "banco_vaga_id" TO "referencia_legada";
ALTER TABLE "lote_itens" ALTER COLUMN "referencia_legada" DROP NOT NULL;
ALTER TABLE "lote_itens" ADD COLUMN "banco_vaga_id" TEXT,
ADD COLUMN "documento_rag_id" TEXT;
ALTER TABLE "lote_itens" ADD CONSTRAINT "lote_itens_uma_referencia_chk" CHECK (num_nonnulls("banco_vaga_id", "documento_rag_id") <= 1);

CREATE TABLE "copiloto_conversas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "modo" "ModoConversaCopiloto" NOT NULL,
    "oportunidade_id" TEXT,
    "pendencia" JSONB,
    "resumo" JSONB,
    "total_mensagens" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copiloto_conversas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copiloto_mensagens" (
    "id" TEXT NOT NULL,
    "conversa_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "papel" "PapelMensagemCopiloto" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tool" TEXT,
    "blocos" JSONB,
    "dados" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copiloto_mensagens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copiloto_confirmacoes" (
    "conversa_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "resultado" JSONB,
    "erro" TEXT,
    "concluida_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copiloto_confirmacoes_pkey" PRIMARY KEY ("conversa_id","call_id")
);

CREATE TABLE "notas_obsidian" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "historico" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_obsidian_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documentos_rag" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "origem" "OrigemDocumentoRag" NOT NULL,
    "origem_id" TEXT NOT NULL,
    "tipo" "TipoDocumentoRag" NOT NULL,
    "factual" BOOLEAN NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "nota_id" TEXT,
    "candidatura_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_rag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "banco_vagas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "fonte" TEXT,
    "descricao" TEXT NOT NULL,
    "status" "StatusBancoVaga" NOT NULL DEFAULT 'CRUA',
    "categoria" TEXT,
    "nivel" TEXT,
    "keywords" JSONB,
    "keywords_status" "StatusKeywords" NOT NULL DEFAULT 'PENDENTE',
    "vaga_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banco_vagas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "copiloto_conversas_usuario_id_atualizado_em_idx" ON "copiloto_conversas"("usuario_id", "atualizado_em" DESC);

CREATE INDEX "copiloto_conversas_usuario_id_oportunidade_id_idx" ON "copiloto_conversas"("usuario_id", "oportunidade_id");

CREATE INDEX "copiloto_conversas_oportunidade_id_idx" ON "copiloto_conversas"("oportunidade_id");

CREATE UNIQUE INDEX "copiloto_mensagens_conversa_id_ordem_key" ON "copiloto_mensagens"("conversa_id", "ordem");

CREATE INDEX "notas_obsidian_usuario_id_idx" ON "notas_obsidian"("usuario_id");

CREATE INDEX "documentos_rag_usuario_id_origem_idx" ON "documentos_rag"("usuario_id", "origem");

CREATE INDEX "documentos_rag_nota_id_idx" ON "documentos_rag"("nota_id");

CREATE INDEX "documentos_rag_candidatura_id_idx" ON "documentos_rag"("candidatura_id");

CREATE INDEX "banco_vagas_usuario_id_status_criado_em_idx" ON "banco_vagas"("usuario_id", "status", "criado_em" DESC);

CREATE INDEX "banco_vagas_vaga_id_idx" ON "banco_vagas"("vaga_id");

CREATE INDEX "lote_itens_banco_vaga_id_idx" ON "lote_itens"("banco_vaga_id");

CREATE INDEX "lote_itens_documento_rag_id_idx" ON "lote_itens"("documento_rag_id");

ALTER TABLE "lote_itens" ADD CONSTRAINT "lote_itens_banco_vaga_id_fkey" FOREIGN KEY ("banco_vaga_id") REFERENCES "banco_vagas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lote_itens" ADD CONSTRAINT "lote_itens_documento_rag_id_fkey" FOREIGN KEY ("documento_rag_id") REFERENCES "documentos_rag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "copiloto_conversas" ADD CONSTRAINT "copiloto_conversas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copiloto_conversas" ADD CONSTRAINT "copiloto_conversas_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "vagas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "copiloto_mensagens" ADD CONSTRAINT "copiloto_mensagens_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "copiloto_conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copiloto_confirmacoes" ADD CONSTRAINT "copiloto_confirmacoes_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "copiloto_conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notas_obsidian" ADD CONSTRAINT "notas_obsidian_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentos_rag" ADD CONSTRAINT "documentos_rag_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentos_rag" ADD CONSTRAINT "documentos_rag_nota_id_fkey" FOREIGN KEY ("nota_id") REFERENCES "notas_obsidian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentos_rag" ADD CONSTRAINT "documentos_rag_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "banco_vagas" ADD CONSTRAINT "banco_vagas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "banco_vagas" ADD CONSTRAINT "banco_vagas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
