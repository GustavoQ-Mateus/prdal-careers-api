import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import { AiClient, AtsAnalysis, Keyword } from '../clients/ai.client';
import { DocClient } from '../clients/doc.client';
import { EventosService } from '../eventos/eventos.service';
import { MongoService } from '../mongo/mongo.service';
import { perfilParaIa } from '../perfil/perfil.normalizacao';
import { PrismaService } from '../prisma/prisma.service';
import { EditarCurriculoDto } from './curriculo.dto';
import { lerArquivo, salvarArquivo } from './storage';

function ordemCurriculo(
  ordenarPor?: string,
): Prisma.CurriculoOrderByWithRelationInput[] {
  if (ordenarPor === 'score') {
    return [
      { score: { sort: 'desc', nulls: 'last' } },
      { geradoEm: 'desc' },
      { id: 'asc' },
    ];
  }
  if (ordenarPor === 'oportunidade') {
    return [
      { vaga: { empresa: 'asc' } },
      { vaga: { titulo: 'asc' } },
      { geradoEm: 'desc' },
      { id: 'asc' },
    ];
  }
  return [{ geradoEm: 'desc' }, { id: 'asc' }];
}

function normalizarKeywords(valor: Prisma.JsonValue): Keyword[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ termo: item.trim(), peso: 1 }];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const termo = 'termo' in item && typeof item.termo === 'string' ? item.termo.trim() : '';
      const peso = 'peso' in item && typeof item.peso === 'number' ? item.peso : 1;
      return termo ? [{ termo, peso }] : [];
    }
    return [];
  });
}

function nomeArquivo(valor: string) {
  return valor.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Curriculo';
}

function listaAnalise(analise: Record<string, unknown>, campo: string): string {
  const valores = analise[campo];
  if (!Array.isArray(valores)) return 'Nenhuma';
  const itens = valores.map((valor) => String(valor).trim()).filter(Boolean);
  return itens.length ? itens.join(', ') : 'Nenhuma';
}

function narracaoAts(inicial: unknown, final: unknown): string | null {
  if (!inicial || typeof inicial !== 'object' || !final || typeof final !== 'object') return null;
  const base = inicial as Record<string, unknown>;
  const pos = final as Record<string, unknown>;
  if (typeof base.score !== 'number' || typeof pos.score !== 'number') return null;
  const pontos = listaAnalise(base, 'pontosEliminatorios');
  const diferenca = pos.score - base.score;
  const comparacao = diferenca > 0
    ? `aumentou ${diferenca} ponto(s)`
    : diferenca < 0
      ? `reduziu ${Math.abs(diferenca)} ponto(s)`
      : 'permaneceu igual';
  return [
    'Etapa 1 — Análise ATS',
    `Score: ${base.score}`,
    `Keywords encontradas: ${listaAnalise(base, 'keywordsEncontradas')}`,
    `Keywords críticas ausentes: ${listaAnalise(base, 'keywordsCriticasAusentes')}`,
    ...(pontos === 'Nenhuma' ? [] : [`Pontos eliminatórios: ${pontos}`]),
    `Veredicto: ${String(base.veredicto ?? 'Sem veredicto informado.')}`,
    '',
    '[[NARRACAO_ATS_ETAPA_3]]',
    '',
    'Etapa 3 — Score pós-geração',
    `Score final: ${pos.score}, comparado ao inicial de ${base.score}: ${comparacao}.`,
  ].join('\n');
}

@Injectable()
export class CurriculosService implements OnModuleInit {
  private readonly logger = new Logger(CurriculosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClient,
    private readonly docClient: DocClient,
    private readonly eventos: EventosService,
    private readonly mongo: MongoService,
  ) {}

  async onModuleInit() {
    const pendentes = await this.prisma.geracaoCurriculo.findMany({
      where: { status: { notIn: ['CONCLUIDA', 'ERRO'] } },
      select: { id: true },
    });
    for (const geracao of pendentes) {
      void this.processar(geracao.id);
    }
    void this.reidratarConcluidas().catch((err) => {
      this.logger.warn(`reidratação de conclusões adiada: ${(err as Error).message}`);
    });
  }

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

    const existente = await this.prisma.geracaoCurriculo.findFirst({
      where: { usuarioId, vagaId },
      orderBy: { criadoEm: 'desc' },
    });
    if (existente) {
      if (existente.status === 'ERRO') {
        const reinicio = await this.prisma.geracaoCurriculo.updateMany({
          where: { id: existente.id, usuarioId, status: 'ERRO' },
          data: {
            status: 'PENDENTE',
            erro: null,
            analiseInicial: Prisma.DbNull,
            analiseFinal: Prisma.DbNull,
            degradacao: null,
          },
        });
        if (reinicio.count > 0) void this.processar(existente.id);
        return { jobId: existente.id, status: 'GERANDO', curriculoId: null };
      }
      return { jobId: existente.id, status: existente.status, curriculoId: existente.curriculoId };
    }

    const geracao = await this.prisma.geracaoCurriculo.create({
      data: { usuarioId, vagaId },
    });
    void this.processar(geracao.id);
    return { jobId: geracao.id };
  }

  async statusGeracao(usuarioId: string, jobId: string) {
    const geracao = await this.prisma.geracaoCurriculo.findFirst({
      where: { id: jobId, usuarioId },
    });
    if (!geracao) throw new NotFoundException('geracao nao encontrada');
    return {
      id: geracao.id,
      vagaId: geracao.vagaId,
      status: geracao.status,
      erro: geracao.erro,
      curriculoId: geracao.curriculoId,
      etapas: {
        analiseInicial: geracao.analiseInicial,
        reescrita: geracao.status === 'GERANDO' || geracao.status === 'VALIDANDO' || geracao.status === 'CONCLUIDA',
        analiseFinal: geracao.analiseFinal,
        degradacao: geracao.degradacao,
      },
    };
  }

  async listar(usuarioId: string, query: {
    vagaId?: string;
    scoreMinimo?: number;
    vinculado?: string;
    categoria?: string;
    nivel?: string;
    de?: string;
    ate?: string;
    ordenarPor?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.CurriculoWhereInput = {
      vaga: {
        usuarioId,
        ...(query.categoria ? { categoria: query.categoria } : {}),
        ...(query.nivel ? { nivel: query.nivel } : {}),
      },
      ...(query.vagaId ? { vagaId: query.vagaId } : {}),
      ...(query.scoreMinimo !== undefined
        ? { score: { gte: query.scoreMinimo } }
        : {}),
      ...(query.de || query.ate
        ? {
            geradoEm: {
              ...(query.de ? { gte: new Date(query.de) } : {}),
              ...(query.ate ? { lte: new Date(query.ate) } : {}),
            },
          }
        : {}),
      ...(query.vinculado === 'true' ? { candidaturas: { some: {} } } : {}),
      ...(query.vinculado === 'false' ? { candidaturas: { none: {} } } : {}),
    };

    const paginar = query.limit !== undefined && query.limit !== null;
    const offset = query.offset ?? 0;

    const [total, curriculos] = await Promise.all([
      this.prisma.curriculo.count({ where }),
      this.prisma.curriculo.findMany({
        where,
        include: {
          vaga: {
            select: {
              id: true,
              titulo: true,
              empresa: true,
              categoria: true,
              nivel: true,
            },
          },
          candidaturas: {
            where: { curriculoId: { not: null } },
            select: { id: true, principal: true, status: true },
          },
        },
        orderBy: ordemCurriculo(query.ordenarPor),
        ...(paginar ? { skip: offset, take: query.limit } : {}),
      }),
    ]);

    const itens = curriculos.map((c) => ({
      id: c.id,
      rotulo: c.rotulo,
      score: c.score,
      breakdown: c.scoreBreakdown,
      analiseInicial: c.analiseInicial,
      analiseFinal: c.analiseFinal,
      degradacao: c.degradacao,
      geradoEm: c.geradoEm,
      vagaId: c.vagaId,
      categoria: c.vaga.categoria,
      nivel: c.vaga.nivel,
      oportunidade: {
        id: c.vaga.id,
        titulo: c.vaga.titulo,
        empresa: c.vaga.empresa,
      },
      vinculo: c.candidaturas[0]
        ? {
            candidaturaId: c.candidaturas[0].id,
            principal: c.candidaturas[0].principal,
            status: c.candidaturas[0].status,
          }
        : null,
      downloadDocxUrl: c.docxPath ? `/curriculos/${c.id}/docx` : null,
      downloadPdfUrl: c.pdfPath ? `/curriculos/${c.id}/pdf` : null,
    }));

    return {
      itens,
      total,
      limit: paginar ? query.limit! : null,
      offset: paginar ? offset : 0,
    };
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
      analiseInicial: true,
      analiseFinal: true,
      degradacao: true,
      geradoEm: true,
      },
    });

    return curriculos.map((c) => ({
      id: c.id,
      rotulo: c.rotulo,
      score: c.score,
      breakdown: c.scoreBreakdown,
      analiseInicial: c.analiseInicial,
      analiseFinal: c.analiseFinal,
      degradacao: c.degradacao,
      geradoEm: c.geradoEm,
    }));
  }

  async editar(usuarioId: string, id: string, dto: EditarCurriculoDto) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
      include: { vaga: true },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    const keywords = normalizarKeywords(curriculo.vaga.keywords);
    const { score, breakdown } = await this.aiClient.score(dto.markdown, {
      keywords,
    });

    const { docxPath, pdfPath } = await this.renderizar(
      curriculo.id,
      dto.markdown,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.curriculo.update({
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
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: curriculo.vagaId,
        curriculoId: curriculo.id,
        tipo: 'CURRICULO_EDITADO',
        origem: 'SISTEMA',
        descricao: 'Curriculo editado',
        dados: { curriculoId: curriculo.id },
      });
    });

    return this.buscar(usuarioId, curriculo.id);
  }

  async buscar(usuarioId: string, id: string) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
      include: {
        vaga: { select: { id: true, titulo: true, empresa: true } },
        candidaturas: {
          where: { curriculoId: { not: null } },
          select: { id: true, principal: true, status: true },
        },
      },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    return {
      id: curriculo.id,
      vagaId: curriculo.vagaId,
      rotulo: curriculo.rotulo,
      markdown: curriculo.markdown,
      score: curriculo.score,
      breakdown: curriculo.scoreBreakdown,
      analiseInicial: curriculo.analiseInicial,
      analiseFinal: curriculo.analiseFinal,
      degradacao: curriculo.degradacao,
      geradoEm: curriculo.geradoEm,
      oportunidade: curriculo.vaga,
      vinculo: curriculo.candidaturas[0] ?? null,
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

  async pacote(usuarioId: string, id: string) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
      include: { vaga: { select: { titulo: true, empresa: true } } },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    const pasta = nomeArquivo(`${curriculo.vaga.titulo} - ${curriculo.vaga.empresa}`);
    const rotulo = nomeArquivo(curriculo.rotulo);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const zip = archiver('zip', { zlib: { level: 9 } });
      const partes: Buffer[] = [];
      zip.on('data', (parte: Buffer) => partes.push(parte));
      zip.on('error', reject);
      zip.on('end', () => resolve(Buffer.concat(partes)));
      zip.append(curriculo.markdown, { name: `${pasta}/Curriculo_${rotulo}.md` });
      void Promise.all([
        curriculo.docxPath ? lerArquivo(curriculo.docxPath).then((arquivo) => zip.append(arquivo, { name: `${pasta}/Curriculo_${rotulo}.docx` })) : null,
        curriculo.pdfPath ? lerArquivo(curriculo.pdfPath).then((arquivo) => zip.append(arquivo, { name: `${pasta}/Curriculo_${rotulo}.pdf` })) : null,
      ]).then(() => void zip.finalize(), reject);
    });
    return { buffer, nome: `${pasta}.zip` };
  }

  private async processar(id: string) {
    const geracao = await this.prisma.geracaoCurriculo.findUnique({
      where: { id },
      include: { vaga: true },
    });
    if (!geracao || geracao.status === 'CONCLUIDA' || geracao.status === 'ERRO') {
      return;
    }

    try {
      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: { status: 'ANALISANDO' },
      });
      const perfil = await this.prisma.perfilMestre.findUnique({
        where: { usuarioId: geracao.usuarioId },
      });
      if (!perfil) throw new Error('perfil-mestre ausente');

      const keywords = normalizarKeywords(geracao.vaga.keywords);
      const contexto = await this.recuperarContexto(
        geracao.usuarioId,
        geracao.vaga,
      );

      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: { status: 'GERANDO' },
      });
      const pipeline = await this.aiClient.generateCvPipeline({
        perfilMestre: perfilParaIa(perfil),
        vaga: {
          titulo: geracao.vaga.titulo,
          empresa: geracao.vaga.empresa,
          descricao: geracao.vaga.descricao,
          keywords,
        },
        keywords,
        contexto,
      });
      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: {
          analiseInicial: pipeline.analiseInicial as unknown as Prisma.InputJsonValue,
          degradacao: pipeline.degradacao,
        },
      });
      const markdown = pipeline.markdown;

      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: {
          status: 'VALIDANDO',
          analiseFinal: pipeline.analiseFinal as unknown as Prisma.InputJsonValue,
        },
      });
      const { score, breakdown } = this.scoreDaAnalise(pipeline.analiseFinal);
      const versoes = await this.prisma.curriculo.count({
        where: { vagaId: geracao.vagaId },
      });
      const curriculoId = randomUUID();
      const { docxPath, pdfPath } = await this.renderizar(curriculoId, markdown);

      await this.prisma.$transaction(async (tx) => {
        await tx.curriculo.create({
          data: {
            id: curriculoId,
            vagaId: geracao.vagaId,
            rotulo: `Versao ${versoes + 1}`,
            markdown,
            docxPath,
            pdfPath,
            score,
            scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
            analiseInicial:
              pipeline.analiseInicial as unknown as Prisma.InputJsonValue,
            analiseFinal: pipeline.analiseFinal as unknown as Prisma.InputJsonValue,
            degradacao: pipeline.degradacao,
          },
        });
        await tx.geracaoCurriculo.update({
          where: { id },
          data: { status: 'CONCLUIDA', curriculoId },
        });
        await this.eventos.registrar(tx, {
          usuarioId: geracao.usuarioId,
          vagaId: geracao.vagaId,
          curriculoId,
          tipo: 'CURRICULO_GERADO',
          origem: 'SISTEMA',
          descricao: 'Curriculo gerado',
          dados: {
            curriculoId,
            scoreInicial: pipeline.analiseInicial.score,
            scoreFinal: score,
            degradacao: pipeline.degradacao,
          },
        });
      });
      await this.persistirConclusaoCopiloto(geracao.usuarioId, id, curriculoId);
    } catch (err) {
      this.logger.warn(`geracao ${id} falhou: ${(err as Error).message}`);
      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: { status: 'ERRO', erro: (err as Error).message },
      });
    }
  }

  private async reidratarConcluidas(): Promise<void> {
    const concluidas = await this.prisma.geracaoCurriculo.findMany({
      where: { status: 'CONCLUIDA', curriculoId: { not: null } },
      select: { id: true, usuarioId: true, curriculoId: true },
      orderBy: { atualizadoEm: 'desc' },
      take: 100,
    });
    await Promise.all(
      concluidas.map((geracao) =>
        this.persistirConclusaoCopiloto(geracao.usuarioId, geracao.id, geracao.curriculoId!),
      ),
    );
  }

  private async persistirConclusaoCopiloto(
    usuarioId: string,
    jobId: string,
    curriculoId: string,
  ): Promise<void> {
    try {
      const curriculo = await this.buscar(usuarioId, curriculoId);
      const narracao = narracaoAts(curriculo.analiseInicial, curriculo.analiseFinal);
      if (!narracao) return;
      const persistido = {
        id: curriculo.id,
        vagaId: curriculo.vagaId,
        rotulo: curriculo.rotulo,
        score: curriculo.score,
        breakdown: curriculo.breakdown,
        analiseInicial: curriculo.analiseInicial,
        analiseFinal: curriculo.analiseFinal,
        degradacao: curriculo.degradacao,
      };
      await this.mongo.anexarConclusaoGeracao(usuarioId, jobId, persistido, narracao);
    } catch (err) {
      this.logger.warn(`narracao da geracao ${jobId} adiada: ${(err as Error).message}`);
    }
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
      let template: string | undefined;
      let pdf = await this.docClient.renderPdf(markdown);
      let paginas = this.contarPaginasPdf(pdf);
      if (paginas > 1) {
        template = 'compact';
        pdf = await this.docClient.renderPdf(markdown, template);
        paginas = this.contarPaginasPdf(pdf);
      }
      const docx = await this.docClient.renderDocx(markdown, template);
      docxPath = await salvarArquivo(`${curriculoId}.docx`, docx);
      if (paginas > 1) {
        this.logger.warn(`curriculo ${curriculoId} gerou PDF com ${paginas} paginas`);
      }
      pdfPath = await salvarArquivo(`${curriculoId}.pdf`, pdf);
    } catch (err) {
      this.logger.warn(`doc-service indisponivel: ${(err as Error).message}`);
    }
    return { docxPath, pdfPath };
  }

  private scoreDaAnalise(analise: AtsAnalysis) {
    return {
      score: analise.score,
      breakdown: analise.breakdown,
    };
  }

  private contarPaginasPdf(pdf: Buffer) {
    const texto = pdf.toString('latin1');
    const matches = texto.match(/\/Type\s*\/Page\b/g);
    return matches?.length ?? 0;
  }
}
