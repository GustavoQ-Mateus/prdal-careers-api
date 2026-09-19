import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import {
  normalizarExperiencias,
  textoExperiencia,
  tituloExperiencia,
} from '../perfil/perfil.normalizacao';

const EMAIL_ALVO = 'gustavoq.mateusgithub@gmail.com';

type DocumentoRag = {
  _id: string;
  usuarioId: string;
  origem: 'perfil' | 'candidatura' | 'nota';
  origemId: string;
  titulo: string;
  texto: string;
  criadoEm: Date;
};

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
): DocumentoRag {
  return {
    _id: randomUUID(),
    usuarioId,
    origem: 'perfil',
    origemId,
    titulo,
    texto,
    criadoEm: new Date(),
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
): DocumentoRag[] {
  const documentos: DocumentoRag[] = [];
  if (perfil.resumo?.trim()) documentos.push(documento(usuarioId, 'resumo', 'Resumo', perfil.resumo));

  normalizarExperiencias(perfil.experiencias).forEach((experiencia) => {
    const texto = textoExperiencia(experiencia);
    if (texto) documentos.push(documento(usuarioId, 'experiencia-' + experiencia.id, tituloExperiencia(experiencia), texto));
  });

  const listas: [string, unknown, string][] = [
    ['formacao', perfil.formacao, 'Formacao'],
    ['certificacao', perfil.certificacoes, 'Certificacao'],
  ];
  for (const [prefixo, valor, titulo] of listas) {
    if (!Array.isArray(valor)) continue;
    valor.forEach((item, indice) => {
      if (String(item).trim()) documentos.push(documento(usuarioId, prefixo + '-' + indice, titulo, String(item)));
    });
  }

  if (Array.isArray(perfil.idiomas) && perfil.idiomas.length) {
    documentos.push(documento(usuarioId, 'idiomas', 'Idiomas', perfil.idiomas.join(', ')));
  }
  if (Array.isArray(perfil.skills) && perfil.skills.length) {
    documentos.push(documento(usuarioId, 'skills', 'Skills', perfil.skills.join(', ')));
  }
  return documentos;
}

async function reindexarConhecimento(
  mongoDb: ReturnType<MongoClient['db']>,
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
  const colecao = mongoDb.collection<DocumentoRag>('documentos_rag');
  const removidos = await colecao.deleteMany({
    usuarioId,
    origem: { $in: ['perfil', 'candidatura'] },
  });
  const perfilDocs = documentosDoPerfil(usuarioId, perfil);
  if (perfilDocs.length) await colecao.insertMany(perfilDocs);

  const documentos = await colecao.find({ usuarioId }).toArray();
  const aiUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
  const resposta = await fetch(aiUrl + '/context/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuarioId,
      documentos: documentos.map(({ usuarioId: id, origem, origemId, titulo, texto }) => ({
        usuarioId: id,
        origem,
        origemId,
        titulo,
        texto,
      })),
    }),
  });
  if (!resposta.ok) {
    throw new Error('reindexacao do conhecimento falhou: HTTP ' + resposta.status);
  }
  return { removidos: removidos.deletedCount, inseridos: perfilDocs.length, total: documentos.length };
}

async function main() {
  const prisma = new PrismaClient();
  const mongo = new MongoClient(process.env.MONGO_URL ?? 'mongodb://localhost:27017');
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL_ALVO } });
    if (!usuario) throw new Error('conta nao encontrada: ' + EMAIL_ALVO);

    const perfil = await prisma.perfilMestre.findUnique({ where: { usuarioId: usuario.id } });
    if (!perfil) throw new Error('perfil-mestre nao encontrado; limpeza abortada');
    const antes = perfilSnapshot(perfil as unknown as Record<string, unknown>);

    const apagadas = await prisma.$transaction(async (tx) => {
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
      };
    });

    const mongoDb = mongo.db(process.env.MONGO_DB ?? 'prdal_careers');
    const conversas = await mongoDb.collection('copiloto_conversas').deleteMany({ usuarioId: usuario.id });
    const conhecimento = await reindexarConhecimento(mongoDb, usuario.id, perfil);

    const depois = await prisma.perfilMestre.findUnique({ where: { usuarioId: usuario.id } });
    const preservado = !!depois && perfilSnapshot(depois as unknown as Record<string, unknown>) === antes;
    if (!preservado) throw new Error('perfil-mestre foi alterado; interrompendo com falha');

    console.log(JSON.stringify({
      usuarioId: usuario.id.slice(0, 8) + '...',
      linhasApagadas: {
        ...apagadas,
        copiloto_conversas: conversas.deletedCount,
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
    await mongo.close();
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
