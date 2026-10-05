import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StatusGeracaoCurriculo } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import { AiClient, AtsAnalysis, FonteContexto, Keyword } from '../clients/ai.client';
import { DocClient } from '../clients/doc.client';
import { EventosService } from '../eventos/eventos.service';
import { RagService } from '../rag/rag.service';
import { ConversasRepositorio } from '../repositorios/conversas.repositorio';
import { perfilParaIa } from '../perfil/perfil.normalizacao';
import type { OrigemGeracao } from '../pipeline-ats/maquina';
import { DadosNarracao, dadosDaNarracao, narrar, resumoDaAnalise } from '../pipeline-ats/narracao';
import { PipelineAtsService } from '../pipeline-ats/pipeline-ats.service';
import { PrismaService } from '../prisma/prisma.service';
import { EditarCurriculoDto } from './curriculo.dto';
import { lerArquivo, salvarArquivo } from './storage';
import { acompanharTrabalho } from '../observabilidade/desligamento';

const GERACAO_EM_ANDAMENTO: StatusGeracaoCurriculo[] = ['PENDENTE', 'ANALISANDO', 'GERANDO', 'VALIDANDO'];

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

function mesclarDegradacao(
  atual: string | null,
  nova: string | null,
): string | null {
  const partes = [atual, nova].filter((parte): parte is string => !!parte);
  return partes.length ? partes.join('; ') : null;
}

export const DEGRADACAO_CONTEXTO =
  'O histórico de notas e candidaturas não pôde ser consultado agora; o currículo foi gerado só com o perfil-mestre.';

interface ContextoRecuperado {
  contexto: FonteContexto[];
  degradacao: string | null;
}

export const DEGRADACAO_RENDERIZACAO =
  'Os arquivos PDF e DOCX não puderam ser gerados agora. O texto do currículo está salvo e você pode gerar os arquivos novamente.';

function semDegradacaoRenderizacao(atual: string | null): string | null {
  if (!atual) return null;
  const partes = atual.split('; ').filter((parte) => parte !== DEGRADACAO_RENDERIZACAO);
  return partes.length ? partes.join('; ') : null;
}

function degradacaoComRenderizacao(atual: string | null, falhou: boolean): string | null {
  const base = semDegradacaoRenderizacao(atual);
  return falhou ? mesclarDegradacao(base, DEGRADACAO_RENDERIZACAO) : base;
}

function nomeArquivo(valor: string) {
  return valor.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Curriculo';
}

@Injectable()
export class CurriculosService implements OnModuleInit {
  private readonly logger = new Logger(CurriculosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClient,
    private readonly docClient: DocClient,
    private readonly eventos: EventosService,
    private readonly conversas: ConversasRepositorio,
    private readonly pipelineAts: PipelineAtsService,
    private readonly rag: RagService,
  ) {}

  async onModuleInit() {
    const pendentes = await this.prisma.geracaoCurriculo.findMany({
      where: { status: { notIn: ['CONCLUIDA', 'ERRO'] } },
      select: { id: true },
    });
    for (const geracao of pendentes) {
      void acompanharTrabalho(this.processar(geracao.id));
    }
    void this.reidratarConcluidas().catch((err) => {
      this.logger.warn(`reidratação de conclusões adiada: ${(err as Error).message}`);
    });
  }

  async gerar(usuarioId: string, vagaId: string, origem: OrigemGeracao = 'direta') {
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
    if (vaga.keywordsStatus !== 'VALIDAS' || !normalizarKeywords(vaga.keywords).length) {
      throw new BadRequestException(
        'a extracao de keywords da oportunidade esta pendente; tente novamente antes de gerar',
      );
    }

    const emAndamento = await this.prisma.geracaoCurriculo.findFirst({
      where: { usuarioId, vagaId, status: { in: GERACAO_EM_ANDAMENTO } },
      orderBy: { criadoEm: 'desc' },
    });
    if (emAndamento) {
      return { jobId: emAndamento.id, status: emAndamento.status, curriculoId: emAndamento.curriculoId };
    }

    const geracao = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.geracaoCurriculo.create({
        data: { usuarioId, vagaId },
      });
      await this.pipelineAts.aplicar(usuarioId, vagaId, { tipo: 'geracao_iniciada', jobId: criada.id, origem }, tx);
      return criada;
    });
    void acompanharTrabalho(this.processar(geracao.id));
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

  async analisarAts(usuarioId: string, vagaId: string): Promise<AtsAnalysis & { degradacao?: string }> {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: vagaId, usuarioId },
    });
    if (!vaga) throw new NotFoundException('vaga nao encontrada');

    const perfil = await this.prisma.perfilMestre.findUnique({
      where: { usuarioId },
    });
    if (!perfil) {
      throw new BadRequestException(
        'cadastre o perfil-mestre antes de analisar a vaga',
      );
    }

    const keywords = normalizarKeywords(vaga.keywords);
    if (vaga.keywordsStatus !== 'VALIDAS' || !keywords.length) {
      throw new BadRequestException(
        'a extracao de keywords da oportunidade esta pendente; tente novamente antes de analisar',
      );
    }

    const { contexto, degradacao } = await this.recuperarContexto(usuarioId, keywords);
    const analise = await this.aiClient.analisarAts({
      perfilMestre: perfilParaIa(perfil),
      vaga: {
        titulo: vaga.titulo,
        empresa: vaga.empresa,
        descricao: vaga.descricao,
        keywords,
      },
      keywords,
      contexto,
    });
    const resumo = resumoDaAnalise(analise);
    if (resumo) {
      await this.pipelineAts.aplicar(usuarioId, vagaId, { tipo: 'analise_concluida', analise: resumo });
    }
    return degradacao ? { ...analise, degradacao } : analise;
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

    if (curriculo.vaga.keywordsStatus !== 'VALIDAS') {
      throw new BadRequestException(
        'a extracao de keywords da oportunidade esta pendente; nao e possivel pontuar',
      );
    }
    const keywords = normalizarKeywords(curriculo.vaga.keywords);
    const { score, breakdown } = await this.aiClient.score(dto.markdown, {
      keywords,
    });

    const { docxPath, pdfPath, falhou } = await this.renderizar(
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
          degradacao: degradacaoComRenderizacao(curriculo.degradacao, falhou),
          estrutura: Prisma.DbNull,
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

  async gerarArquivos(usuarioId: string, id: string) {
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id, vaga: { usuarioId } },
    });
    if (!curriculo) throw new NotFoundException('curriculo nao encontrado');

    const { docxPath, pdfPath, falhou } = await this.renderizar(curriculo.id, curriculo.markdown);
    await this.prisma.curriculo.update({
      where: { id: curriculo.id },
      data: {
        docxPath,
        pdfPath,
        degradacao: degradacaoComRenderizacao(curriculo.degradacao, falhou),
      },
    });
    if (falhou) throw new ServiceUnavailableException(DEGRADACAO_RENDERIZACAO);
    return this.buscar(usuarioId, curriculo.id);
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
      if (
        geracao.vaga.keywordsStatus !== 'VALIDAS' ||
        !normalizarKeywords(geracao.vaga.keywords).length
      ) {
        throw new Error(
          'extracao de keywords pendente; tente novamente antes de gerar o curriculo',
        );
      }

      const keywords = normalizarKeywords(geracao.vaga.keywords);
      const { contexto, degradacao: degradacaoContexto } = await this.recuperarContexto(geracao.usuarioId, keywords);

      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: { status: 'GERANDO' },
      });
      const pipeline = await this.aiClient.generateCvPipeline(
        {
          perfilMestre: perfilParaIa(perfil),
          vaga: {
            titulo: geracao.vaga.titulo,
            empresa: geracao.vaga.empresa,
            descricao: geracao.vaga.descricao,
            keywords,
          },
          keywords,
          contexto,
        },
        { operacao: `geracao:${id}`, usuarioId: geracao.usuarioId },
      );
      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: {
          analiseInicial: pipeline.analiseInicial as unknown as Prisma.InputJsonValue,
          degradacao: mesclarDegradacao(degradacaoContexto, pipeline.degradacao),
        },
      });
      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: {
          status: 'VALIDANDO',
          analiseFinal: pipeline.analiseFinal as unknown as Prisma.InputJsonValue,
        },
      });
      const versoes = await this.prisma.curriculo.count({
        where: { vagaId: geracao.vagaId },
      });
      const curriculoId = randomUUID();

      let markdown = pipeline.markdown;
      let analiseFinal = pipeline.analiseFinal;
      let degradacao = mesclarDegradacao(degradacaoContexto, pipeline.degradacao);
      const modelo = pipeline.modelo ?? null;
      const promptVersion = pipeline.promptVersion ?? null;
      let { docxPath, pdfPath, paginas, falhou } = await this.renderizar(
        curriculoId,
        markdown,
      );

      let rodadas = 0;
      const estruturaGerada = pipeline.estrutura ?? null;
      let estrutura = estruturaGerada;
      while (paginas > 1 && rodadas < 2 && estruturaGerada) {
        rodadas += 1;
        this.logger.warn(
          `curriculo ${curriculoId} com ${paginas} paginas; rodada ${rodadas} de corte de conteudo`,
        );
        try {
          const reducao = await this.aiClient.reduzirCurriculo(
            {
              perfilMestre: perfilParaIa(perfil),
              vaga: {
                titulo: geracao.vaga.titulo,
                empresa: geracao.vaga.empresa,
                descricao: geracao.vaga.descricao,
                keywords,
              },
              keywords,
              estrutura: estruturaGerada,
              nivel: rodadas,
            },
            { operacao: `geracao:${id}` },
          );
          if (reducao.markdown === markdown) break;
          markdown = reducao.markdown;
          analiseFinal = reducao.analiseFinal;
          estrutura = reducao.estrutura ?? estrutura;
          ({ docxPath, pdfPath, paginas, falhou } = await this.renderizar(
            curriculoId,
            markdown,
          ));
        } catch (err) {
          this.logger.warn(
            `corte de conteudo indisponivel para ${curriculoId}: ${(err as Error).message}`,
          );
          break;
        }
      }
      if (paginas > 1) {
        degradacao = mesclarDegradacao(
          degradacao,
          `Curriculo mantido com ${paginas} paginas apos ${rodadas} rodada(s) de corte de conteudo`,
        );
      }
      degradacao = degradacaoComRenderizacao(degradacao, falhou);

      const { score, breakdown } = this.scoreDaAnalise(analiseFinal);

      await this.prisma.$transaction(async (tx) => {
        await tx.curriculo.create({
          data: {
            id: curriculoId,
            vagaId: geracao.vagaId,
            rotulo: `${geracao.vaga.empresa} · ${geracao.vaga.titulo}${versoes > 0 ? ` (regeração ${versoes + 1})` : ''}`,
            markdown,
            docxPath,
            pdfPath,
            score,
            scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
            analiseInicial:
              pipeline.analiseInicial as unknown as Prisma.InputJsonValue,
            analiseFinal: analiseFinal as unknown as Prisma.InputJsonValue,
            degradacao,
            modelo,
            promptVersion,
            estrutura: estrutura === null ? Prisma.DbNull : (estrutura as Prisma.InputJsonValue),
          },
        });
        await tx.geracaoCurriculo.update({
          where: { id },
          data: {
            status: 'CONCLUIDA',
            curriculoId,
            analiseFinal: analiseFinal as unknown as Prisma.InputJsonValue,
            degradacao,
          },
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
            degradacao,
          },
        });
      });
      const narracao = dadosDaNarracao(pipeline.analiseInicial, analiseFinal, degradacao);
      await this.transicionarSemFalhar(id, () =>
        this.pipelineAts.aplicar(geracao.usuarioId, geracao.vagaId, {
          tipo: 'geracao_concluida',
          jobId: id,
          curriculoId,
          narracao,
        }),
      );
      await this.persistirConclusaoCopiloto(geracao.usuarioId, id, curriculoId, narracao);
    } catch (err) {
      this.logger.warn(`geracao ${id} falhou: ${(err as Error).message}`);
      await this.prisma.geracaoCurriculo.update({
        where: { id },
        data: { status: 'ERRO', erro: (err as Error).message },
      });
      await this.transicionarSemFalhar(id, () =>
        this.pipelineAts.aplicar(geracao.usuarioId, geracao.vagaId, {
          tipo: 'geracao_falhou',
          jobId: id,
          erro: (err as Error).message,
        }),
      );
    }
  }

  private async transicionarSemFalhar(jobId: string, transicao: () => Promise<unknown>): Promise<void> {
    try {
      await transicao();
    } catch (err) {
      this.logger.warn(`pipeline ATS sem transicao job=${jobId} causa=${(err as Error).message}`);
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
    dados?: DadosNarracao | null,
  ): Promise<void> {
    try {
      const curriculo = await this.buscar(usuarioId, curriculoId);
      const narracao =
        dados ??
        (await this.pipelineAts.narracaoDaGeracao(usuarioId, jobId)) ??
        dadosDaNarracao(curriculo.analiseInicial, curriculo.analiseFinal, curriculo.degradacao);
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
      await this.conversas.anexarConclusaoGeracao(usuarioId, jobId, persistido, narrar(narracao), narracao);
    } catch (err) {
      this.logger.warn(`narracao da geracao ${jobId} adiada: ${(err as Error).message}`);
    }
  }

  private async recuperarContexto(
    usuarioId: string,
    keywords: Keyword[],
  ): Promise<ContextoRecuperado> {
    const consultas = [...keywords]
      .sort((a, b) => b.peso - a.peso)
      .map((keyword) => keyword.termo);
    if (!consultas.length) return { contexto: [], degradacao: null };
    try {
      const { chunks, degradacao } = await this.rag.recuperar(usuarioId, consultas);
      return { contexto: chunks, degradacao };
    } catch (err) {
      this.logger.warn(
        `degradacao codigo=contexto_rag_indisponivel usuario=${usuarioId} causa=${(err as Error).message}`,
      );
      return { contexto: [], degradacao: DEGRADACAO_CONTEXTO };
    }
  }

  private async renderizar(curriculoId: string, markdown: string) {
    let docxPath: string | null = null;
    let pdfPath: string | null = null;
    let paginas = 0;
    let falhou = false;
    try {
      let template: string | undefined;
      let pdf = await this.docClient.renderPdf(markdown);
      paginas = this.contarPaginasPdf(pdf);
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
      falhou = true;
      docxPath = null;
      pdfPath = null;
      paginas = 0;
      this.logger.warn(
        `degradacao codigo=renderizacao_doc_service_indisponivel curriculo=${curriculoId} causa=${(err as Error).message}`,
      );
    }
    return { docxPath, pdfPath, paginas, falhou };
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
