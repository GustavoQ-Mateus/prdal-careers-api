import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LotesService } from '../lotes/lotes.service';
import {
  listaCertificacoes,
  listaFormacao,
  listaTexto,
  normalizarExperiencias,
  textoExperiencia,
  tituloExperiencia,
} from '../perfil/perfil.normalizacao';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentosRagRepositorio, NovoDocumentoRag } from '../repositorios/documentos-rag.repositorio';
import { NotaObsidianRegistro, OrigemDocumentoRag, TipoDocumentoRag } from '../repositorios/tipos';
import { ArquivoTexto } from './upload-texto';

@Injectable()
export class ContextoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentosRagRepositorio,
    private readonly lotes: LotesService,
  ) {}

  async reindexar(usuarioId: string) {
    const perfil = await this.prisma.perfilMestre.findUnique({
      where: { usuarioId },
    });

    const novos: NovoDocumentoRag[] = [];
    const doc = (
      origem: OrigemDocumentoRag,
      tipo: TipoDocumentoRag,
      origemId: string,
      titulo: string,
      texto: string,
    ): NovoDocumentoRag => ({
      id: randomUUID(),
      usuarioId,
      origem,
      origemId,
      tipo,
      factual: origem === 'perfil',
      titulo,
      texto,
      notaId: null,
      candidaturaId: origem === 'candidatura' ? origemId : null,
    });

    if (perfil) {
      if (perfil.resumo?.trim()) {
        novos.push(doc('perfil', 'resumo', 'resumo', 'Resumo', perfil.resumo));
      }
      normalizarExperiencias(perfil.experiencias).forEach((experiencia) => {
        const texto = textoExperiencia(experiencia);
        if (texto) {
          novos.push(doc('perfil', 'experiencia', experiencia.id, tituloExperiencia(experiencia), texto));
        }
      });
      listaFormacao(perfil.formacao).forEach((formacao, i) => {
        novos.push(doc('perfil', 'formacao', `formacao-${i}`, 'Formacao', formacao));
      });
      listaCertificacoes(perfil.certificacoes).forEach((certificacao, i) => {
        novos.push(doc('perfil', 'certificacao', `certificacao-${i}`, 'Certificacao', certificacao));
      });
      const idiomas = listaTexto(perfil.idiomas);
      if (idiomas.length) {
        novos.push(doc('perfil', 'idiomas', 'idiomas', 'Idiomas', idiomas.join(', ')));
      }
      const skills = listaTexto(perfil.skills);
      if (skills.length) {
        novos.push(doc('perfil', 'skills', 'skills', 'Skills', skills.join(', ')));
      }
    }

    const candidaturas = await this.prisma.candidatura.findMany({
      where: { vaga: { usuarioId }, notas: { not: '' } },
      include: { vaga: { select: { titulo: true } } },
    });
    for (const c of candidaturas) {
      if (c.notas.trim()) {
        novos.push(doc('candidatura', 'candidatura', c.id, c.vaga.titulo, c.notas));
      }
    }

    const ids = await this.documentos.substituirPerfilECandidaturas(usuarioId, novos);
    const lote = await this.lotes.criar(usuarioId, 'INGESTAO', ids);
    return { loteId: lote.id, total: ids.length };
  }

  async upload(usuarioId: string, arquivos: ArquivoTexto[], historico = false) {
    const notas = arquivos.map(({ titulo, corpo }) => {
      const nota: NotaObsidianRegistro = { id: randomUUID(), usuarioId, titulo, corpo, historico, criadoEm: new Date() };
      const documento: NovoDocumentoRag = {
        id: randomUUID(),
        usuarioId,
        origem: 'nota',
        origemId: nota.id,
        tipo: 'nota',
        factual: historico,
        titulo,
        texto: corpo,
        notaId: nota.id,
        candidaturaId: null,
      };
      return { nota, documento };
    });
    await this.documentos.inserirNotas(notas);
    const documentos = notas.map(({ documento }) => documento);
    const lote = await this.lotes.criar(
      usuarioId,
      'INGESTAO',
      documentos.map((d) => d.id),
    );
    return { loteId: lote.id, total: documentos.length };
  }

  async status(usuarioId: string) {
    const documentos = await this.documentos.contar(usuarioId);
    const ultimo = await this.prisma.lote.findFirst({
      where: { usuarioId, tipo: 'INGESTAO' },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    const [perfil, candidatura, nota] = await Promise.all([
      this.documentos.contar(usuarioId, 'perfil'),
      this.documentos.contar(usuarioId, 'candidatura'),
      this.documentos.contar(usuarioId, 'nota'),
    ]);
    return {
      documentos,
      ultimaIndexacao: ultimo?.criadoEm ?? null,
      porOrigem: { perfil, candidatura, nota },
      disponivel: true,
    };
  }
}
