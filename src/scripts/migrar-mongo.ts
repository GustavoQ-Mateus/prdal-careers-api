import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Db } from 'mongodb';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RagModule } from '../rag/rag.module';
import { RagService } from '../rag/rag.service';
import { reindexarDesatualizados, ResultadoReindexacao } from '../rag/reindexacao';
import { RepositoriosModule } from '../repositorios/repositorios.module';
import { OrigemDocumentoRag, TipoDocumentoRag, tipoPadraoRag } from '../repositorios/tipos';

@Module({ imports: [PrismaModule, RepositoriosModule, RagModule] })
class MigrarMongoModule {}

export const COLECOES = ['notas_obsidian', 'banco_vagas', 'documentos_rag', 'copiloto_conversas'] as const;
type Colecao = (typeof COLECOES)[number];

const TABELAS = ['notas_obsidian', 'vagas', 'documentos_rag', 'copiloto_conversas', 'copiloto_mensagens', 'copiloto_confirmacoes', 'chunks_rag'] as const;
const ORIGENS: OrigemDocumentoRag[] = ['perfil', 'candidatura', 'nota'];
const TIPOS: TipoDocumentoRag[] = ['experiencia', 'resumo', 'skills', 'formacao', 'certificacao', 'idiomas', 'nota', 'candidatura'];
const PAPEIS = ['user', 'assistant', 'tool', 'evento'] as const;

type Documento = Record<string, unknown> & { _id: unknown };

export interface Relatorio {
  antes: { mongo: Record<Colecao, number>; postgres: Record<string, number> };
  depois: { postgres: Record<string, number> };
  migrados: Record<Colecao, number>;
  jaExistentes: Record<Colecao, number>;
  naoMigrados: { colecao: Colecao; id: string; motivo: string }[];
  avisos: { colecao: Colecao; id: string; aviso: string }[];
  loteItens: { pendentes: number; documentoRag: number; vaga: number; semReferencia: number };
  reindexacao: ResultadoReindexacao | { pulada: string };
}

function texto(valor: unknown, padrao = ''): string {
  return typeof valor === 'string' ? valor : valor === null || valor === undefined ? padrao : String(valor);
}

function data(valor: unknown): Date {
  const convertida = valor instanceof Date ? valor : new Date(texto(valor));
  return Number.isNaN(convertida.getTime()) ? new Date() : convertida;
}

function json(valor: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return valor === null || valor === undefined ? Prisma.DbNull : (JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue);
}

function opcional(valor: unknown): Prisma.InputJsonValue | undefined {
  return valor === null || valor === undefined ? undefined : (JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue);
}

async function contarPostgres(prisma: PrismaClient): Promise<Record<string, number>> {
  const contagens: Record<string, number> = {};
  for (const tabela of TABELAS) {
    const [linha] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(`SELECT count(*) AS total FROM ${tabela}`);
    contagens[tabela] = Number(linha.total);
  }
  return contagens;
}

async function conjunto(consulta: Promise<{ id: string }[]>): Promise<Set<string>> {
  return new Set((await consulta).map((linha) => linha.id));
}

export async function migrar(prisma: PrismaClient, mongo: Db, rag: RagService | null): Promise<Relatorio> {
  const contar = (colecao: Colecao) => mongo.collection(colecao).countDocuments();
  const antesMongo = Object.fromEntries(await Promise.all(COLECOES.map(async (c) => [c, await contar(c)]))) as Record<Colecao, number>;
  const relatorio: Relatorio = {
    antes: { mongo: antesMongo, postgres: await contarPostgres(prisma) },
    depois: { postgres: {} },
    migrados: { notas_obsidian: 0, banco_vagas: 0, documentos_rag: 0, copiloto_conversas: 0 },
    jaExistentes: { notas_obsidian: 0, banco_vagas: 0, documentos_rag: 0, copiloto_conversas: 0 },
    naoMigrados: [],
    avisos: [],
    loteItens: { pendentes: 0, documentoRag: 0, vaga: 0, semReferencia: 0 },
    reindexacao: { pulada: 'nao executada' },
  };
  const recusar = (colecao: Colecao, id: string, motivo: string) => relatorio.naoMigrados.push({ colecao, id, motivo });
  const avisar = (colecao: Colecao, id: string, aviso: string) => relatorio.avisos.push({ colecao, id, aviso });

  const usuarios = await conjunto(prisma.usuario.findMany({ select: { id: true } }));
  const vagas = await conjunto(prisma.vaga.findMany({ select: { id: true } }));
  const candidaturas = await conjunto(prisma.candidatura.findMany({ select: { id: true } }));
  const ler = (colecao: Colecao) => mongo.collection<Documento>(colecao).find().toArray();

  const notasExistentes = await conjunto(prisma.notaObsidian.findMany({ select: { id: true } }));
  for (const doc of await ler('notas_obsidian')) {
    const id = texto(doc._id);
    if (notasExistentes.has(id)) { relatorio.jaExistentes.notas_obsidian += 1; continue; }
    const usuarioId = texto(doc.usuarioId);
    if (!usuarios.has(usuarioId)) { recusar('notas_obsidian', id, 'usuario inexistente no postgres'); continue; }
    await prisma.notaObsidian.create({
      data: { id, usuarioId, titulo: texto(doc.titulo), corpo: texto(doc.corpo), historico: doc.historico === true, criadoEm: data(doc.criadoEm) },
    });
    notasExistentes.add(id);
    relatorio.migrados.notas_obsidian += 1;
  }

  for (const doc of await ler('banco_vagas')) {
    const id = texto(doc._id);
    if (vagas.has(id)) { relatorio.jaExistentes.banco_vagas += 1; continue; }
    const usuarioId = texto(doc.usuarioId);
    if (!usuarios.has(usuarioId)) { recusar('banco_vagas', id, 'usuario inexistente no postgres'); continue; }
    if (doc.status === 'ATIVADA') {
      const vagaLegada = texto(doc.origemRelacionalId) || null;
      if (vagaLegada && !vagas.has(vagaLegada)) avisar('banco_vagas', id, `oportunidade ${vagaLegada} nao existe mais; entrada ativada nao recriada`);
      else relatorio.jaExistentes.banco_vagas += 1;
      continue;
    }
    const keywords = Array.isArray(doc.keywords) ? doc.keywords : [];
    const validas = doc.keywordsStatus === 'VALIDAS' && keywords.length > 0;
    await prisma.vaga.create({
      data: {
        id,
        usuarioId,
        titulo: texto(doc.titulo),
        empresa: texto(doc.empresa),
        fonte: texto(doc.fonte) || null,
        descricao: texto(doc.descricao),
        categoria: texto(doc.categoria) || null,
        nivel: texto(doc.nivel) || null,
        keywords: JSON.parse(JSON.stringify(keywords)) as Prisma.InputJsonValue,
        keywordsStatus: validas ? 'VALIDAS' : 'PENDENTE',
        keywordsExtracao: validas ? 'PRONTAS' : 'PENDENTE',
        origem: 'IMPORTACAO',
        estagio: 'ENTRADA',
        criadoEm: data(doc.criadoEm),
        atualizadoEm: data(doc.criadoEm),
      },
    });
    vagas.add(id);
    relatorio.migrados.banco_vagas += 1;
  }

  const documentosExistentes = await conjunto(prisma.documentoRag.findMany({ select: { id: true } }));
  for (const doc of await ler('documentos_rag')) {
    const id = texto(doc._id);
    if (documentosExistentes.has(id)) { relatorio.jaExistentes.documentos_rag += 1; continue; }
    const usuarioId = texto(doc.usuarioId);
    const origem = texto(doc.origem) as OrigemDocumentoRag;
    const origemId = texto(doc.origemId);
    if (!usuarios.has(usuarioId)) { recusar('documentos_rag', id, 'usuario inexistente no postgres'); continue; }
    if (!ORIGENS.includes(origem)) { recusar('documentos_rag', id, `origem desconhecida: ${origem}`); continue; }
    if (!texto(doc.texto).trim()) { recusar('documentos_rag', id, 'texto vazio'); continue; }
    if (origem === 'nota' && !notasExistentes.has(origemId)) { recusar('documentos_rag', id, `nota ${origemId} nao existe`); continue; }
    if (origem === 'candidatura' && !candidaturas.has(origemId)) {
      recusar('documentos_rag', id, `candidatura ${origemId} nao existe mais; a reindexacao do perfil recria o que existir`);
      continue;
    }
    const tipoGravado = texto(doc.tipo) as TipoDocumentoRag;
    const tipo = TIPOS.includes(tipoGravado) ? tipoGravado : tipoPadraoRag(origem, origemId);
    if (!TIPOS.includes(tipoGravado)) avisar('documentos_rag', id, `sem tipo; tipo ${tipo} pela origem`);
    await prisma.documentoRag.create({
      data: {
        id,
        usuarioId,
        origem,
        origemId,
        tipo,
        factual: typeof doc.factual === 'boolean' ? doc.factual : origem === 'perfil',
        titulo: texto(doc.titulo),
        texto: texto(doc.texto),
        notaId: origem === 'nota' ? origemId : null,
        candidaturaId: origem === 'candidatura' ? origemId : null,
        criadoEm: data(doc.criadoEm),
      },
    });
    documentosExistentes.add(id);
    relatorio.migrados.documentos_rag += 1;
  }

  const conversasExistentes = await conjunto(prisma.copilotoConversa.findMany({ select: { id: true } }));
  for (const doc of await ler('copiloto_conversas')) {
    const id = texto(doc._id);
    if (conversasExistentes.has(id)) { relatorio.jaExistentes.copiloto_conversas += 1; continue; }
    const usuarioId = texto(doc.usuarioId);
    if (!usuarios.has(usuarioId)) { recusar('copiloto_conversas', id, 'usuario inexistente no postgres'); continue; }
    const mensagens = Array.isArray(doc.mensagens) ? (doc.mensagens as Record<string, unknown>[]) : [];
    const invalida = mensagens.findIndex((m) => !PAPEIS.includes(m?.papel as (typeof PAPEIS)[number]));
    if (invalida >= 0) { recusar('copiloto_conversas', id, `mensagem ${invalida} com papel desconhecido`); continue; }
    const oportunidadeLegada = texto(doc.oportunidadeId) || null;
    const oportunidadeId = oportunidadeLegada && vagas.has(oportunidadeLegada) ? oportunidadeLegada : null;
    if (oportunidadeLegada && !oportunidadeId) avisar('copiloto_conversas', id, `oportunidade ${oportunidadeLegada} nao existe mais; ligacao removida`);
    const vistas = new Set<string>();
    const confirmacoes = (Array.isArray(doc.confirmacoes) ? (doc.confirmacoes as Record<string, unknown>[]) : []).filter((c) => {
      const callId = texto(c.callId);
      if (!callId || vistas.has(callId)) return false;
      vistas.add(callId);
      return true;
    });
    await prisma.$transaction(async (tx) => {
      await tx.copilotoConversa.create({
        data: {
          id,
          usuarioId,
          modo: doc.modo === 'autopiloto' ? 'autopiloto' : 'assistido',
          oportunidadeId,
          pendencia: json(doc.pendencia),
          resumo: json(doc.resumo),
          totalMensagens: mensagens.length,
          criadoEm: data(doc.criadoEm),
          atualizadoEm: data(doc.atualizadoEm ?? doc.criadoEm),
        },
      });
      if (mensagens.length) {
        await tx.copilotoMensagem.createMany({
          data: mensagens.map((m, ordem) => ({
            conversaId: id,
            ordem,
            papel: m.papel as (typeof PAPEIS)[number],
            conteudo: texto(m.conteudo),
            tool: texto(m.tool) || null,
            blocos: opcional(m.blocos),
            dados: opcional(m.dados),
          })),
        });
      }
      if (confirmacoes.length) {
        await tx.copilotoConfirmacao.createMany({
          data: confirmacoes.map((c) => ({
            conversaId: id,
            callId: texto(c.callId),
            tool: texto(c.tool),
            decisao: texto(c.decisao),
            resultado: opcional(c.resultado),
            erro: texto(c.erro) || null,
            concluidaEm: data(c.concluidaEm),
          })),
        });
      }
    });
    conversasExistentes.add(id);
    relatorio.migrados.copiloto_conversas += 1;
  }

  const itens = await prisma.loteItem.findMany({
    where: { referenciaLegada: { not: null }, vagaId: null, documentoRagId: null },
    include: { lote: { select: { tipo: true } } },
  });
  relatorio.loteItens.pendentes = itens.length;
  for (const item of itens) {
    const referencia = item.referenciaLegada!;
    if (item.lote.tipo === 'INGESTAO' && documentosExistentes.has(referencia)) {
      await prisma.loteItem.update({ where: { id: item.id }, data: { documentoRagId: referencia } });
      relatorio.loteItens.documentoRag += 1;
    } else if (item.lote.tipo !== 'INGESTAO' && vagas.has(referencia)) {
      await prisma.loteItem.update({ where: { id: item.id }, data: { vagaId: referencia } });
      relatorio.loteItens.vaga += 1;
    } else {
      relatorio.loteItens.semReferencia += 1;
    }
  }

  relatorio.reindexacao = rag ? await reindexarDesatualizados(prisma as PrismaService, rag) : { pulada: 'executado com --sem-reindexar' };
  relatorio.depois.postgres = await contarPostgres(prisma);
  return relatorio;
}

async function main() {
  const semReindexar = process.argv.includes('--sem-reindexar');
  const { MongoClient } = await import('mongodb');
  const cliente = new MongoClient(process.env.MONGO_URL ?? 'mongodb://localhost:27017');
  const app = await NestFactory.createApplicationContext(MigrarMongoModule, { logger: ['error', 'warn'] });
  try {
    await cliente.connect();
    const relatorio = await migrar(
      app.get(PrismaService),
      cliente.db(process.env.MONGO_DB ?? 'prdal_careers'),
      semReindexar ? null : app.get(RagService),
    );
    console.log(JSON.stringify(relatorio, null, 2));
    const falhasReindexacao = 'falhas' in relatorio.reindexacao ? relatorio.reindexacao.falhas.length : 0;
    if (falhasReindexacao) process.exitCode = 1;
  } finally {
    await cliente.close();
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
