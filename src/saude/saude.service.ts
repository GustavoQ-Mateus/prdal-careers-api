import { Injectable, Logger, Optional } from '@nestjs/common';
import { cabecalhoServico } from '../config/servico';
import { cabecalhoRequestId } from '../observabilidade/contexto';
import { Fila } from '../jobs/fila';
import { PrismaService } from '../prisma/prisma.service';

export type EstadoDependencia = 'ok' | 'indisponivel' | 'desconhecido';

export interface SituacaoDependencia {
  nome: string;
  obrigatoria: boolean;
  estado: EstadoDependencia;
  detalhe?: string;
}

export type DependenciaPublica = Omit<SituacaoDependencia, 'detalhe'>;

export interface Prontidao {
  servico: 'api';
  status: 'pronto' | 'indisponivel';
  dependencias: DependenciaPublica[];
}

const PRAZO_PADRAO_MS = 2000;

function prazoMs(): number {
  const valor = Number(process.env.PRONTIDAO_TIMEOUT_MS);
  return Number.isFinite(valor) && valor > 0 ? valor : PRAZO_PADRAO_MS;
}

function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let relogio: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error(`sem resposta em ${ms} ms`)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

function motivo(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class SaudeService {
  private readonly logger = new Logger('Prontidao');

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly fila?: Fila,
  ) {}

  async prontidao(): Promise<Prontidao> {
    const ms = prazoMs();
    const [postgres, ia, doc, fila] = await Promise.all([
      this.verificar('postgres', true, () => this.prisma.$queryRaw`SELECT 1`, ms),
      this.aiService(ms),
      this.verificar('doc-service', false, () => this.http(`${this.docUrl()}/health`, ms), ms),
      this.fila
        ? this.verificar('fila', false, () => this.fila!.verificar(), ms)
        : Promise.resolve<SituacaoDependencia>({ nome: 'fila', obrigatoria: false, estado: 'desconhecido' }),
    ]);
    const dependencias = [postgres, ...ia, doc, fila];
    const pronto = dependencias.every((d) => !d.obrigatoria || d.estado === 'ok');
    for (const { nome, obrigatoria, estado, detalhe } of dependencias) {
      if (estado !== 'ok') this.logger.warn({ mensagem: 'dependencia fora', dependencia: nome, obrigatoria, estado, detalhe });
    }
    return {
      servico: 'api',
      status: pronto ? 'pronto' : 'indisponivel',
      dependencias: dependencias.map(({ nome, obrigatoria, estado }) => ({ nome, obrigatoria, estado })),
    };
  }

  private async verificar(nome: string, obrigatoria: boolean, sonda: () => Promise<unknown>, ms: number): Promise<SituacaoDependencia> {
    try {
      await comPrazo(sonda(), ms);
      return { nome, obrigatoria, estado: 'ok' };
    } catch (err) {
      return { nome, obrigatoria, estado: 'indisponivel', detalhe: motivo(err) };
    }
  }

  private async aiService(ms: number): Promise<SituacaoDependencia[]> {
    try {
      const resposta = await this.http(`${this.aiUrl()}/ready`, ms, true);
      const corpo = (await resposta.json().catch(() => ({}))) as { dependencias?: SituacaoDependencia[] };
      const embeddings = corpo.dependencias?.find((d) => d.nome === 'embeddings');
      return [
        resposta.ok
          ? { nome: 'ai-service', obrigatoria: false, estado: 'ok' }
          : { nome: 'ai-service', obrigatoria: false, estado: 'indisponivel', detalhe: `ready respondeu ${resposta.status}` },
        embeddings
          ? { nome: 'embeddings', obrigatoria: false, estado: embeddings.estado, detalhe: 'informado pelo ready do ai-service' }
          : { nome: 'embeddings', obrigatoria: false, estado: 'desconhecido', detalhe: 'ai-service nao informou' },
      ];
    } catch (err) {
      return [
        { nome: 'ai-service', obrigatoria: false, estado: 'indisponivel', detalhe: motivo(err) },
        { nome: 'embeddings', obrigatoria: false, estado: 'desconhecido', detalhe: 'ai-service indisponivel' },
      ];
    }
  }

  private async http(url: string, ms: number, aceitaQualquerStatus = false): Promise<Response> {
    const resposta = await fetch(url, { headers: { ...cabecalhoServico(), ...cabecalhoRequestId() }, signal: AbortSignal.timeout(ms) });
    if (!aceitaQualquerStatus && !resposta.ok) throw new Error(`respondeu ${resposta.status}`);
    return resposta;
  }

  private aiUrl(): string {
    return process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
  }

  private docUrl(): string {
    return process.env.DOC_SERVICE_URL ?? 'http://localhost:8080';
  }
}
