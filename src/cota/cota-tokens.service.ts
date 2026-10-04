import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UsoLlm } from '../clients/ai.client';

export const COTA_TOKENS_DIA_PADRAO = 1_000_000;
const DIA_MS = 86_400_000;

export const PESO_ENTRADA = 1;
export const PESO_CACHE_ESCRITA = 1.25;
export const PESO_CACHE_LIDA = 0.1;
export const PESO_SAIDA = 5;

export const MENSAGEM_COTA_ESGOTADA =
  'Você atingiu o limite diário de uso do assistente de IA. O limite volta a valer à meia-noite (UTC).';

export class CotaTokensEsgotada extends HttpException {
  constructor(readonly retryAfterSegundos: number) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: MENSAGEM_COTA_ESGOTADA, retryAfter: retryAfterSegundos },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export function limiteDiario(): number {
  const bruto = process.env.COTA_TOKENS_DIA?.trim();
  if (!bruto) return COTA_TOKENS_DIA_PADRAO;
  const valor = Number(bruto);
  return Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : COTA_TOKENS_DIA_PADRAO;
}

export function tokensEquivalentes(uso: {
  entrada: number;
  saida: number;
  cacheLida: number;
  cacheEscrita: number;
}): number {
  return Math.ceil(
    uso.entrada * PESO_ENTRADA +
      uso.cacheEscrita * PESO_CACHE_ESCRITA +
      uso.cacheLida * PESO_CACHE_LIDA +
      uso.saida * PESO_SAIDA,
  );
}

export function diaUtc(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

export function segundosAteVirada(agora: Date): number {
  return Math.max(1, Math.ceil((diaUtc(agora).getTime() + DIA_MS - agora.getTime()) / 1000));
}

@Injectable()
export class CotaTokensService {
  constructor(private readonly prisma: PrismaService) {}

  protected agora(): Date {
    return new Date();
  }

  async consumido(usuarioId: string): Promise<number> {
    const uso = await this.prisma.usoTokensDiario.findUnique({
      where: { usuarioId_dia: { usuarioId, dia: diaUtc(this.agora()) } },
    });
    if (!uso) return 0;
    return tokensEquivalentes(uso);
  }

  async verificar(usuarioId: string): Promise<void> {
    const limite = limiteDiario();
    if (limite === 0) return;
    if ((await this.consumido(usuarioId)) >= limite) {
      throw new CotaTokensEsgotada(segundosAteVirada(this.agora()));
    }
  }

  async registrar(usuarioId: string, uso: UsoLlm | null | undefined): Promise<void> {
    if (!uso || !uso.chamadas) return;
    const valores = {
      entrada: uso.entrada ?? 0,
      saida: uso.saida ?? 0,
      cacheLida: uso.cacheLida ?? 0,
      cacheEscrita: uso.cacheEscrita ?? 0,
      chamadas: uso.chamadas,
    };
    await this.prisma.usoTokensDiario.upsert({
      where: { usuarioId_dia: { usuarioId, dia: diaUtc(this.agora()) } },
      create: { usuarioId, dia: diaUtc(this.agora()), ...valores },
      update: {
        entrada: { increment: valores.entrada },
        saida: { increment: valores.saida },
        cacheLida: { increment: valores.cacheLida },
        cacheEscrita: { increment: valores.cacheEscrita },
        chamadas: { increment: valores.chamadas },
      },
    });
  }
}
