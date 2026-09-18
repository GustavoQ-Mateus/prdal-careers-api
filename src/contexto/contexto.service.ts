import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LotesService } from '../lotes/lotes.service';
import { DocumentoRagDoc, MongoService } from '../mongo/mongo.service';
import { normalizarExperiencias, textoExperiencia, tituloExperiencia } from '../perfil/perfil.normalizacao';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContextoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly lotes: LotesService,
  ) {}

  async reindexar(usuarioId: string) {
    const perfil = await this.prisma.perfilMestre.findUnique({
      where: { usuarioId },
    });

    const novos: DocumentoRagDoc[] = [];
    const doc = (
      origem: DocumentoRagDoc['origem'],
      origemId: string,
      titulo: string,
      texto: string,
    ): DocumentoRagDoc => ({
      _id: randomUUID(),
      usuarioId,
      origem,
      origemId,
      titulo,
      texto,
      criadoEm: new Date(),
    });

    if (perfil) {
      if (perfil.resumo?.trim()) {
        novos.push(doc('perfil', 'resumo', 'Resumo', perfil.resumo));
      }
      normalizarExperiencias(perfil.experiencias).forEach((experiencia) => {
        const texto = textoExperiencia(experiencia);
        if (texto) {
          novos.push(doc('perfil', `experiencia-${experiencia.id}`, tituloExperiencia(experiencia), texto));
        }
      });
      (perfil.formacao as string[]).forEach((f, i) => {
        if (String(f).trim()) novos.push(doc('perfil', `formacao-${i}`, 'Formacao', String(f)));
      });
      (perfil.certificacoes as string[]).forEach((certificacao, i) => {
        if (String(certificacao).trim()) {
          novos.push(doc('perfil', `certificacao-${i}`, 'Certificacao', String(certificacao)));
        }
      });
      const idiomas = perfil.idiomas as string[];
      if (idiomas?.length) {
        novos.push(doc('perfil', 'idiomas', 'Idiomas', idiomas.join(', ')));
      }
      const skills = perfil.skills as string[];
      if (skills?.length) {
        novos.push(doc('perfil', 'skills', 'Skills', skills.join(', ')));
      }
    }

    const candidaturas = await this.prisma.candidatura.findMany({
      where: { vaga: { usuarioId }, notas: { not: '' } },
      include: { vaga: { select: { titulo: true } } },
    });
    for (const c of candidaturas) {
      if (c.notas.trim()) {
        novos.push(doc('candidatura', c.id, c.vaga.titulo, c.notas));
      }
    }

    await this.mongo.documentosRag().deleteMany({
      usuarioId,
      origem: { $in: ['perfil', 'candidatura'] },
    });
    if (novos.length) await this.mongo.documentosRag().insertMany(novos);

    const todos = await this.mongo
      .documentosRag()
      .find({ usuarioId })
      .toArray();
    const ids = todos.map((d) => d._id);
    const lote = await this.lotes.criar(usuarioId, 'INGESTAO', ids);
    return { loteId: lote.id, total: ids.length };
  }

  async upload(
    usuarioId: string,
    arquivos: { originalname: string; buffer: Buffer }[],
  ) {
    const documentos: DocumentoRagDoc[] = [];
    for (const arquivo of arquivos) {
      const notaId = randomUUID();
      const titulo = arquivo.originalname.replace(/\.md$/i, '');
      const corpo = arquivo.buffer.toString('utf8');
      await this.mongo.notasObsidian().insertOne({
        _id: notaId,
        usuarioId,
        titulo,
        corpo,
        criadoEm: new Date(),
      });
      documentos.push({
        _id: randomUUID(),
        usuarioId,
        origem: 'nota',
        origemId: notaId,
        titulo,
        texto: corpo,
        criadoEm: new Date(),
      });
    }
    if (documentos.length) {
      await this.mongo.documentosRag().insertMany(documentos);
    }
    const lote = await this.lotes.criar(
      usuarioId,
      'INGESTAO',
      documentos.map((d) => d._id),
    );
    return { loteId: lote.id, total: documentos.length };
  }

  async status(usuarioId: string) {
    const documentos = await this.mongo
      .documentosRag()
      .countDocuments({ usuarioId });
    const ultimo = await this.prisma.lote.findFirst({
      where: { usuarioId, tipo: 'INGESTAO' },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    const [perfil, candidatura, nota] = await Promise.all([
      this.mongo.documentosRag().countDocuments({ usuarioId, origem: 'perfil' }),
      this.mongo
        .documentosRag()
        .countDocuments({ usuarioId, origem: 'candidatura' }),
      this.mongo.documentosRag().countDocuments({ usuarioId, origem: 'nota' }),
    ]);
    return {
      documentos,
      ultimaIndexacao: ultimo?.criadoEm ?? null,
      porOrigem: { perfil, candidatura, nota },
      disponivel: true,
    };
  }
}
