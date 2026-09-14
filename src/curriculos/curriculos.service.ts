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
import { EditarCurriculoDto } from './curriculo.dto';
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
    const contexto = await this.recuperarContexto(usuarioId, vaga);

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
      contexto,
    });

    const { score, breakdown } = await this.aiClient.score(markdown, {
      keywords,
    });

    const versoes = await this.prisma.curriculo.count({
      where: { vagaId: vaga.id },
    });

    const curriculoId = randomUUID();
    const { docxPath, pdfPath } = await this.renderizar(curriculoId, markdown);

    const curriculo = await this.prisma.curriculo.create({
      data: {
        id: curriculoId,
        vagaId: vaga.id,
        rotulo: `Versao ${versoes + 1}`,
        markdown,
        docxPath,
        pdfPath,
        score,
        scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      },
    });

    return { jobId: curriculo.id };
  }

  async listarPorVaga(usuarioId: string, vagaId: string) {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: vagaId, usuarioId },
    });
    if (!vaga) throw new NotFoundException('vaga nao encontrada');

    const curriculos = await this.prisma.curriculo.findMany({
      where: { vagaId },
      orderBy: { geradoEm: 'desc' },
      select: {
        id: true,
        rotulo: true,
        score: true,
        scoreBreakdown: true,
        geradoEm: true,
      },
    });

    return curriculos.map((c) => ({
      id: c.id,
      rotulo: c.rotulo,
      score: c.score,
      breakdown: c.scoreBreakdown,
      geradoEm: c.geradoEm,
    }));
  }

  async editar(usuarioId: string, id: string, dto: EditarCurriculoDto) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
      include: { vaga: true },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    const keywords = curriculo.vaga.keywords as unknown as Keyword[];
    const { score, breakdown } = await this.aiClient.score(dto.markdown, {
      keywords,
    });

    const { docxPath, pdfPath } = await this.renderizar(
      curriculo.id,
      dto.markdown,
    );

    await this.prisma.curriculo.update({
      where: { id: curriculo.id },
      data: {
        markdown: dto.markdown,
        score,
        scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
        docxPath,
        pdfPath,
        ...(dto.rotulo ? { rotulo: dto.rotulo } : {}),
      },
    });

    return this.buscar(usuarioId, curriculo.id);
  }

  async buscar(usuarioId: string, id: string) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    return {
      id: curriculo.id,
      vagaId: curriculo.vagaId,
      rotulo: curriculo.rotulo,
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

  private async recuperarContexto(
    usuarioId: string,
    vaga: { titulo: string; descricao: string },
  ): Promise<string[]> {
    try {
      const { chunks } = await this.aiClient.contextQuery(
        usuarioId,
        `${vaga.titulo} ${vaga.descricao}`,
      );
      return chunks.map((c) => c.texto);
    } catch (err) {
      this.logger.warn(`contexto indisponivel: ${(err as Error).message}`);
      return [];
    }
  }

  private async renderizar(curriculoId: string, markdown: string) {
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
    return { docxPath, pdfPath };
  }
}
