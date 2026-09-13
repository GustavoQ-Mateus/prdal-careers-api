import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AiClient, Keyword } from '../clients/ai.client';
import { DocClient } from '../clients/doc.client';
import { PrismaService } from '../prisma/prisma.service';
import { lerArquivo, salvarArquivo } from './storage';

@Injectable()
export class CurriculosService {
  private readonly logger = new Logger(CurriculosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClient,
    private readonly docClient: DocClient,
  ) {}

  async gerar(usuarioId: string, vagaId: string) {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: vagaId, usuarioId },
    });
    if (!vaga) throw new NotFoundException('vaga nao encontrada');

    const perfil = await this.prisma.perfilMestre.findUnique({
      where: { usuarioId },
    });
    if (!perfil) {
      throw new BadRequestException(
        'cadastre o perfil-mestre antes de gerar um curriculo',
      );
    }

    const keywords = vaga.keywords as unknown as Keyword[];

    const markdown = await this.aiClient.generateCv({
      perfilMestre: {
        nome: perfil.nome,
        contato: perfil.contato,
        resumo: perfil.resumo,
        experiencias: perfil.experiencias,
        formacao: perfil.formacao,
        skills: perfil.skills,
      },
      vaga: {
        titulo: vaga.titulo,
        empresa: vaga.empresa,
        descricao: vaga.descricao,
        keywords,
      },
      keywords,
      contexto: [],
    });

    const { score, breakdown } = await this.aiClient.score(markdown, {
      keywords,
    });

    const curriculoId = randomUUID();
    let docxPath: string | null = null;
    let pdfPath: string | null = null;
    try {
      const docx = await this.docClient.renderDocx(markdown);
      docxPath = await salvarArquivo(`${curriculoId}.docx`, docx);
      const pdf = await this.docClient.renderPdf(markdown);
      pdfPath = await salvarArquivo(`${curriculoId}.pdf`, pdf);
    } catch (err) {
      this.logger.warn(`doc-service indisponivel: ${(err as Error).message}`);
    }

    const curriculo = await this.prisma.curriculo.create({
      data: {
        id: curriculoId,
        vagaId: vaga.id,
        markdown,
        docxPath,
        pdfPath,
        score,
        scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      },
    });

    return { jobId: curriculo.id };
  }

  async buscar(usuarioId: string, id: string) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    return {
      id: curriculo.id,
      vagaId: curriculo.vagaId,
      markdown: curriculo.markdown,
      score: curriculo.score,
      breakdown: curriculo.scoreBreakdown,
      geradoEm: curriculo.geradoEm,
      downloadDocxUrl: curriculo.docxPath
        ? `/curriculos/${curriculo.id}/docx`
        : null,
      downloadPdfUrl: curriculo.pdfPath
        ? `/curriculos/${curriculo.id}/pdf`
        : null,
    };
  }

  async arquivo(usuarioId: string, id: string, formato: 'docx' | 'pdf') {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');
    const caminho = formato === 'docx' ? curriculo.docxPath : curriculo.pdfPath;
    if (!caminho) throw new NotFoundException('arquivo indisponivel');
    return lerArquivo(caminho);
  }
}
