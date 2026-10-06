import { applyDecorators, ExecutionContext, Injectable, UseGuards } from '@nestjs/common';
import {
  Throttle,
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';

const MINUTO_MS = 60_000;
const HORA_MS = 3_600_000;

export const JANELAS: ThrottlerOptions[] = [
  { name: 'minuto', ttl: MINUTO_MS, limit: Number.MAX_SAFE_INTEGER },
  { name: 'hora', ttl: HORA_MS, limit: Number.MAX_SAFE_INTEGER },
];

export const LIMITES = {
  login: { minuto: 5, hora: 20 },
  cadastro: { minuto: 5, hora: 10 },
  refresh: { minuto: 30, hora: 300 },
  chat: { minuto: 30, hora: 300 },
  telemetria: { minuto: 30, hora: 300 },
  geracao: { minuto: 5, hora: 30 },
  criacao: { minuto: 20, hora: 200 },
  ia: { minuto: 10, hora: 100 },
  lote: { minuto: 2, hora: 10 },
} as const;

@Injectable()
export class LimiteRequisicoesGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const usuarioId = req.user?.userId;
    return usuarioId ? `usuario:${usuarioId}` : `ip:${req.ip}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detalhe: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    res.header('Retry-After', String(detalhe.timeToBlockExpire));
    throw new ThrottlerException(
      `muitas requisicoes; tente novamente em ${detalhe.timeToBlockExpire} segundos`,
    );
  }
}

export function LimitarRequisicoes(limite: { minuto: number; hora: number }) {
  return applyDecorators(
    Throttle({
      minuto: { limit: limite.minuto, ttl: MINUTO_MS },
      hora: { limit: limite.hora, ttl: HORA_MS },
    }),
    UseGuards(LimiteRequisicoesGuard),
  );
}
