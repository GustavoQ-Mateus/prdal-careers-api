import { Injectable } from '@nestjs/common';
import { cabecalhoServico } from '../config/servico';
import { cabecalhoRequestId } from '../observabilidade/contexto';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma/prisma.service';

export type EstadoDependencia = 'ok' | 'indisponivel' | 'desconhecido';

export interface SituacaoDependencia {
  nome: string;
  obrigatoria: boolean;
  estado: EstadoDependencia;
  detalhe?: string;
}

export interface Prontidao {
  servico: 'api';
  status: 'pronto' | 'indisponivel';
  dependencias: SituacaoDependencia[];
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
  ) {}

  async prontidao(): Promise<Prontidao> {
    const ms = prazoMs();
    const [postgres, mongo, ia, doc] = await Promise.all([
      this.verificar('postgres', true, () => this.prisma.$queryRaw`SELECT 1`, ms),
      this.verificar('mongo', true, () => this.mongo.ping(), ms),
      this.aiService(ms),
      this.verificar('doc-service', false, () => this.http(`${this.docUrl()}/health`, ms), ms),
    ]);
    const dependencias = [postgres, mongo, ...ia, doc];
    const pronto = dependencias.every((d) => !d.obrigatoria || d.estado === 'ok');
    return { servico: 'api', status: pronto ? 'pronto' : 'indisponivel', dependencias };
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
      const chroma = corpo.dependencias?.find((d) => d.nome === 'chroma');
      return [
        resposta.ok
          ? { nome: 'ai-service', obrigatoria: false, estado: 'ok' }
          : { nome: 'ai-service', obrigatoria: false, estado: 'indisponivel', detalhe: `ready respondeu ${resposta.status}` },
        chroma
          ? { nome: 'chroma', obrigatoria: false, estado: chroma.estado, ...(chroma.detalhe ? { detalhe: chroma.detalhe } : {}) }
          : { nome: 'chroma', obrigatoria: false, estado: 'desconhecido', detalhe: 'ai-service nao informou' },
      ];
    } catch (err) {
      return [
        { nome: 'ai-service', obrigatoria: false, estado: 'indisponivel', detalhe: motivo(err) },
        { nome: 'chroma', obrigatoria: false, estado: 'desconhecido', detalhe: 'ai-service indisponivel' },
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
