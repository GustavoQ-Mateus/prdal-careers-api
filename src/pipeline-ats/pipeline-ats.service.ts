import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  avisoDaAcao,
  EventoAts,
  ForaDeOrdem,
  mensagensForaDeOrdem,
  MensagensForaDeOrdem,
  SituacaoAts,
  situacaoDeLegado,
  transicionar,
  verificarOrdem,
} from './maquina';
import { DadosNarracao, dadosNarracaoValidos } from './narracao';

type Banco = Prisma.TransactionClient | PrismaService;

const TENTATIVAS_CONCORRENCIA = 3;
const ESTADOS_SENSIVEIS_AO_PERFIL = ['ANALISADA', 'AGUARDANDO_CONFIRMACAO', 'GERANDO', 'CONCLUIDA'] as const;

export class TransicaoRecusada extends ConflictException {
  readonly paraModelo: string;

  constructor(
    readonly situacao: SituacaoAts,
    readonly fora: ForaDeOrdem,
    readonly evento: EventoAts['tipo'],
  ) {
    super(`Etapa fora de ordem: ${fora.motivo}. Próximo passo: ${fora.proximoPassoCandidato}.`);
    this.paraModelo = `Etapa fora de ordem: ${fora.motivo}. Próximo passo válido: ${fora.proximoPasso}.`;
  }
}

export interface ConferenciaAcao {
  fora: MensagensForaDeOrdem | null;
  aviso: string | null;
}

function foraDaTransicao(transicao: { motivo: string; proximoPasso: string; proximoPassoCandidato: string }): ForaDeOrdem {
  return {
    motivo: transicao.motivo,
    proximoPasso: transicao.proximoPasso,
    proximoPassoCandidato: transicao.proximoPassoCandidato,
  };
}

class VersaoConcorrente extends Error {}

interface LinhaPipeline {
  vagaId: string;
  usuarioId: string;
  estado: SituacaoAts['estado'];
  jobId: string | null;
  curriculoId: string | null;
  perfilAlteradoNaGeracao: boolean;
  versao: number;
}

function daLinha(linha: LinhaPipeline): SituacaoAts {
  return {
    estado: linha.estado,
    jobId: linha.jobId,
    curriculoId: linha.curriculoId,
    perfilAlteradoNaGeracao: linha.perfilAlteradoNaGeracao,
  };
}

function dadosDoEvento(evento: EventoAts): Prisma.InputJsonValue {
  switch (evento.tipo) {
    case 'analise_concluida':
      return { analise: evento.analise } as unknown as Prisma.InputJsonValue;
    case 'geracao_iniciada':
      return { origem: evento.origem };
    case 'geracao_concluida':
      return { curriculoId: evento.curriculoId, narracao: evento.narracao } as unknown as Prisma.InputJsonValue;
    case 'geracao_falhou':
      return { erro: evento.erro };
    default:
      return {};
  }
}

function jobDoEvento(evento: EventoAts): string | null {
  return 'jobId' in evento ? evento.jobId : null;
}

function duplicada(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class PipelineAtsService {
  constructor(private readonly prisma: PrismaService) {}

  async situacao(usuarioId: string, vagaId: string, banco: Banco = this.prisma): Promise<SituacaoAts> {
    const linha = (await banco.pipelineAts.findUnique({ where: { vagaId } })) as LinhaPipeline | null;
    if (linha) {
      if (linha.usuarioId !== usuarioId) throw new NotFoundException('vaga nao encontrada');
      return daLinha(linha);
    }
    return this.legado(banco, usuarioId, vagaId);
  }

  async verificar(usuarioId: string, vagaId: string, evento: EventoAts): Promise<SituacaoAts> {
    const atual = await this.situacao(usuarioId, vagaId);
    const transicao = transicionar(atual, evento);
    if (!transicao.aceita) {
      throw new TransicaoRecusada(atual, foraDaTransicao(transicao), evento.tipo);
    }
    return atual;
  }

  async conferir(
    usuarioId: string,
    vagaId: string,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<ConferenciaAcao> {
    const atual = await this.situacao(usuarioId, vagaId);
    const fora = verificarOrdem(tool, args, atual);
    return {
      fora: fora ? mensagensForaDeOrdem(tool, atual, fora) : null,
      aviso: fora ? null : avisoDaAcao(tool, args, atual),
    };
  }

  async aplicar(
    usuarioId: string,
    vagaId: string,
    evento: EventoAts,
    banco?: Prisma.TransactionClient,
  ): Promise<SituacaoAts> {
    if (banco) return this.aplicarNo(banco, usuarioId, vagaId, evento);
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.prisma.$transaction((tx) => this.aplicarNo(tx, usuarioId, vagaId, evento));
      } catch (err) {
        const concorrente = err instanceof VersaoConcorrente || duplicada(err);
        if (!concorrente || tentativa >= TENTATIVAS_CONCORRENCIA) {
          if (concorrente) {
            throw new ConflictException('o pipeline ATS desta oportunidade mudou durante a operação; tente de novo');
          }
          throw err;
        }
      }
    }
  }

  async perfilAlterado(usuarioId: string, banco?: Prisma.TransactionClient): Promise<void> {
    const executar = async (db: Prisma.TransactionClient) => {
      const afetados = await db.pipelineAts.findMany({
        where: { usuarioId, estado: { in: [...ESTADOS_SENSIVEIS_AO_PERFIL] } },
        select: { vagaId: true },
      });
      const legados = await db.vaga.findMany({
        where: { usuarioId, pipelineAts: null, geracoes: { some: {} } },
        select: { id: true },
      });
      const vagas = [...afetados.map((linha) => linha.vagaId), ...legados.map((vaga) => vaga.id)];
      for (const vagaId of vagas) {
        await this.aplicarNo(db, usuarioId, vagaId, { tipo: 'perfil_alterado' });
      }
    };
    if (banco) return executar(banco);
    await this.prisma.$transaction(executar);
  }

  async narracaoDaGeracao(usuarioId: string, jobId: string): Promise<DadosNarracao | null> {
    const evento = await this.prisma.eventoPipelineAts.findFirst({
      where: { usuarioId, jobId, tipo: 'geracao_concluida' },
      orderBy: { ocorridoEm: 'desc' },
    });
    const dados = evento?.dados as { narracao?: unknown } | undefined;
    return dados ? dadosNarracaoValidos(dados.narracao) : null;
  }

  async eventos(usuarioId: string, vagaId: string) {
    return this.prisma.eventoPipelineAts.findMany({
      where: { usuarioId, vagaId },
      orderBy: { ocorridoEm: 'asc' },
    });
  }

  private async legado(banco: Banco, usuarioId: string, vagaId: string): Promise<SituacaoAts> {
    const geracao = await banco.geracaoCurriculo.findFirst({
      where: { usuarioId, vagaId },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, status: true, curriculoId: true },
    });
    return situacaoDeLegado(geracao);
  }

  private async aplicarNo(
    db: Prisma.TransactionClient,
    usuarioId: string,
    vagaId: string,
    evento: EventoAts,
  ): Promise<SituacaoAts> {
    const linha = (await db.pipelineAts.findUnique({ where: { vagaId } })) as LinhaPipeline | null;
    if (linha && linha.usuarioId !== usuarioId) throw new NotFoundException('vaga nao encontrada');
    const atual = linha ? daLinha(linha) : await this.legado(db, usuarioId, vagaId);
    const transicao = transicionar(atual, evento);
    if (!transicao.aceita) {
      throw new TransicaoRecusada(atual, foraDaTransicao(transicao), evento.tipo);
    }
    if (!transicao.registrar) return atual;
    const proxima = transicao.situacao;
    if (linha) {
      const { count } = await db.pipelineAts.updateMany({
        where: { vagaId, versao: linha.versao },
        data: { ...proxima, versao: linha.versao + 1 },
      });
      if (count === 0) throw new VersaoConcorrente();
    } else {
      await db.pipelineAts.create({ data: { vagaId, usuarioId, ...proxima, versao: 1 } });
    }
    await db.eventoPipelineAts.create({
      data: {
        vagaId,
        usuarioId,
        tipo: evento.tipo,
        de: atual.estado,
        para: proxima.estado,
        jobId: jobDoEvento(evento),
        dados: dadosDoEvento(evento),
      },
    });
    return proxima;
  }
}
