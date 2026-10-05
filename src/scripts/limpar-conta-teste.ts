import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  listaCertificacoes,
  listaFormacao,
  listaTexto,
  normalizarExperiencias,
  textoExperiencia,
  tituloExperiencia,
} from '../perfil/perfil.normalizacao';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RagModule } from '../rag/rag.module';
import { RagService } from '../rag/rag.service';
import { reindexarDesatualizados } from '../rag/reindexacao';
import { DocumentosRagRepositorio, NovoDocumentoRag } from '../repositorios/documentos-rag.repositorio';
import { RepositoriosModule } from '../repositorios/repositorios.module';
import { tipoPadraoRag } from '../repositorios/tipos';

@Module({ imports: [PrismaModule, RepositoriosModule, RagModule] })
class LimparContaTesteModule {}

const AMBIENTES_PERMITIDOS = ['teste', 'desenvolvimento'];

export interface OpcoesLimpeza {
  email: string;
  executar: boolean;
}

export function lerOpcoes(argv: string[], env: Record<string, string | undefined>): OpcoesLimpeza {
  const ambiente = env.PRDAL_AMBIENTE?.trim().toLowerCase() ?? '';
  if (!AMBIENTES_PERMITIDOS.includes(ambiente)) {
    throw new Error(
      'limpeza recusada: defina PRDAL_AMBIENTE como teste ou desenvolvimento (atual: ' + (ambiente || 'ausente') + ')',
    );
  }

  let email = '';
  let executar = false;
  let simular = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--executar') executar = true;
    else if (arg === '--dry-run') simular = true;
    else if (arg === '--email') email = argv[++i] ?? '';
    else if (arg.startsWith('--email=')) email = arg.slice('--email='.length);
    else throw new Error('argumento desconhecido: ' + arg);
  }

  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new Error('informe a conta alvo com --email <email>');
  }
  if (executar && simular) throw new Error('use --dry-run ou --executar, nao os dois');
  return { email, executar };
}

function perfilSnapshot(perfil: Record<string, unknown>) {
  return JSON.stringify({
    id: perfil.id,
    usuarioId: perfil.usuarioId,
    nome: perfil.nome,
    contato: perfil.contato,
    resumo: perfil.resumo,
    experiencias: perfil.experiencias,
    formacao: perfil.formacao,
    certificacoes: perfil.certificacoes,
    idiomas: perfil.idiomas,
    skills: perfil.skills,
    atualizadoEm: perfil.atualizadoEm,
  });
}

function documento(
  usuarioId: string,
  origemId: string,
  titulo: string,
  texto: string,
): NovoDocumentoRag {
  return {
    id: randomUUID(),
    usuarioId,
    origem: 'perfil',
    origemId,
    tipo: tipoPadraoRag('perfil', origemId),
    factual: true,
    titulo,
    texto,
    notaId: null,
    candidaturaId: null,
  };
}

function documentosDoPerfil(
  usuarioId: string,
  perfil: {
    resumo: string;
    experiencias: unknown;
    formacao: unknown;
    certificacoes: unknown;
    idiomas: unknown;
    skills: unknown;
  },
): NovoDocumentoRag[] {
  const documentos: NovoDocumentoRag[] = [];
  if (perfil.resumo?.trim()) documentos.push(documento(usuarioId, 'resumo', 'Resumo', perfil.resumo));

  normalizarExperiencias(perfil.experiencias).forEach((experiencia) => {
    const texto = textoExperiencia(experiencia);
    if (texto) documentos.push(documento(usuarioId, 'experiencia-' + experiencia.id, tituloExperiencia(experiencia), texto));
  });

  const listas: [string, string[], string][] = [
    ['formacao', listaFormacao(perfil.formacao), 'Formacao'],
    ['certificacao', listaCertificacoes(perfil.certificacoes), 'Certificacao'],
  ];
  for (const [prefixo, itens, titulo] of listas) {
    itens.forEach((item, indice) => documentos.push(documento(usuarioId, prefixo + '-' + indice, titulo, item)));
  }

  const idiomas = listaTexto(perfil.idiomas);
  if (idiomas.length) documentos.push(documento(usuarioId, 'idiomas', 'Idiomas', idiomas.join(', ')));
  const skills = listaTexto(perfil.skills);
  if (skills.length) documentos.push(documento(usuarioId, 'skills', 'Skills', skills.join(', ')));
  return documentos;
}

export async function reindexarConhecimento(
  documentos: DocumentosRagRepositorio,
  prisma: PrismaService,
  rag: RagService,
  usuarioId: string,
  perfil: {
    resumo: string;
    experiencias: unknown;
    formacao: unknown;
    certificacoes: unknown;
    idiomas: unknown;
    skills: unknown;
  },
) {
  const removidos = await prisma.documentoRag.count({ where: { usuarioId, origem: { in: ['perfil', 'candidatura'] } } });
  const perfilDocs = documentosDoPerfil(usuarioId, perfil);
  const ids = await documentos.substituirPerfilECandidaturas(usuarioId, perfilDocs);
  const reindexacao = await reindexarDesatualizados(prisma, rag, { usuarioId, todos: true });
  if (reindexacao.falhas.length) {
    throw new Error('reindexacao do conhecimento falhou: ' + reindexacao.falhas.map((f) => f.motivo).join('; '));
  }
  return { removidos, inseridos: perfilDocs.length, total: ids.length, chunks: reindexacao.chunks };
}

export async function simular(prisma: PrismaClient, usuarioId: string) {
  const [candidaturas, acoes, layouts, eventos, geracoes, curriculos, vagas, conversas, rag] = await Promise.all([
    prisma.candidatura.count({ where: { vaga: { usuarioId } } }),
    prisma.acaoOportunidade.count({ where: { usuarioId } }),
    prisma.pipelineLayout.count({ where: { usuarioId } }),
    prisma.eventoOportunidade.count({ where: { usuarioId } }),
    prisma.geracaoCurriculo.count({ where: { usuarioId } }),
    prisma.curriculo.count({ where: { vaga: { usuarioId } } }),
    prisma.vaga.count({ where: { usuarioId } }),
    prisma.copilotoConversa.count({ where: { usuarioId } }),
    prisma.documentoRag.count({ where: { usuarioId, origem: { in: ['perfil', 'candidatura'] } } }),
  ]);
  return {
    candidaturas,
    acoes,
    pipeline_layouts: layouts,
    eventos_oportunidade: eventos,
    geracoes_curriculo: geracoes,
    curriculos,
    vagas,
    copiloto_conversas: conversas,
    documentos_rag_perfil_ou_candidatura: rag,
  };
}

async function main() {
  const opcoes = lerOpcoes(process.argv.slice(2), process.env);
  const app = await NestFactory.createApplicationContext(LimparContaTesteModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: opcoes.email } });
    if (!usuario) throw new Error('conta nao encontrada: ' + opcoes.email);

    if (!opcoes.executar) {
      console.log(JSON.stringify({
        modo: 'dry-run',
        usuarioId: usuario.id.slice(0, 8) + '...',
        apagaria: await simular(prisma, usuario.id),
        preservaria: ['perfil-mestre', 'notas enviadas', 'conta'],
        executar: 'repita com --executar para apagar',
      }, null, 2));
      return;
    }

    const perfil = await prisma.perfilMestre.findUnique({ where: { usuarioId: usuario.id } });
    if (!perfil) throw new Error('perfil-mestre nao encontrado; limpeza abortada');
    const antes = perfilSnapshot(perfil as unknown as Record<string, unknown>);

    const apagadas = await prisma.$transaction(async (tx) => {
      const conversas = await tx.copilotoConversa.deleteMany({ where: { usuarioId: usuario.id } });
      const candidaturas = await tx.candidatura.deleteMany({ where: { vaga: { usuarioId: usuario.id } } });
      const acoes = await tx.acaoOportunidade.deleteMany({ where: { usuarioId: usuario.id } });
      const layouts = await tx.pipelineLayout.deleteMany({ where: { usuarioId: usuario.id } });
      const eventos = await tx.eventoOportunidade.deleteMany({ where: { usuarioId: usuario.id } });
      const geracoes = await tx.geracaoCurriculo.deleteMany({ where: { usuarioId: usuario.id } });
      const curriculos = await tx.curriculo.deleteMany({ where: { vaga: { usuarioId: usuario.id } } });
      const vagas = await tx.vaga.deleteMany({ where: { usuarioId: usuario.id } });
      return {
        candidaturas: candidaturas.count,
        acoes: acoes.count,
        pipeline_layouts: layouts.count,
        eventos_oportunidade: eventos.count,
        geracoes_curriculo: geracoes.count,
        curriculos: curriculos.count,
        vagas: vagas.count,
        copiloto_conversas: conversas.count,
      };
    });

    const conhecimento = await reindexarConhecimento(
      app.get(DocumentosRagRepositorio),
      prisma,
      app.get(RagService),
      usuario.id,
      perfil,
    );

    const depois = await prisma.perfilMestre.findUnique({ where: { usuarioId: usuario.id } });
    const preservado = !!depois && perfilSnapshot(depois as unknown as Record<string, unknown>) === antes;
    if (!preservado) throw new Error('perfil-mestre foi alterado; interrompendo com falha');

    console.log(JSON.stringify({
      usuarioId: usuario.id.slice(0, 8) + '...',
      linhasApagadas: {
        ...apagadas,
        documentos_rag_perfil_ou_candidatura: conhecimento.removidos,
        scores_analises: {
          curriculos: apagadas.curriculos,
          geracoes_curriculo: apagadas.geracoes_curriculo,
        },
      },
      conhecimento,
      perfilMestre: { id: depois.id, preservado: true, inalterado: true },
    }, null, 2));
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
