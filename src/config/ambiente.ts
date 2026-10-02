import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

export const TAMANHO_MINIMO_JWT_SECRET = 32;
export const TAMANHO_MINIMO_SERVICE_TOKEN = 32;

export interface Ambiente {
  NODE_ENV?: string;
  JWT_SECRET: string;
  [chave: string]: unknown;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function validarAmbiente(env: Record<string, unknown>): Ambiente {
  const desenvolvimento = env.NODE_ENV === 'development';
  const segredo = texto(env.JWT_SECRET);
  const tokenServico = texto(env.SERVICE_TOKEN);

  if (!desenvolvimento && Buffer.byteLength(tokenServico, 'utf8') < TAMANHO_MINIMO_SERVICE_TOKEN) {
    throw new Error(
      `SERVICE_TOKEN ausente ou com menos de ${TAMANHO_MINIMO_SERVICE_TOKEN} bytes; defina o token de servico compartilhado com ai-service e doc-service antes de subir a api fora de NODE_ENV=development`,
    );
  }

  if (Buffer.byteLength(segredo, 'utf8') >= TAMANHO_MINIMO_JWT_SECRET) return { ...env, JWT_SECRET: segredo };

  if (!desenvolvimento) {
    throw new Error(
      `JWT_SECRET ausente ou com menos de ${TAMANHO_MINIMO_JWT_SECRET} bytes; defina um segredo aleatorio antes de subir a api fora de NODE_ENV=development`,
    );
  }

  new Logger('Ambiente').warn(
    'JWT_SECRET ausente ou curto em desenvolvimento; usando segredo aleatorio desta execucao, as sessoes expiram a cada reinicio',
  );
  return { ...env, JWT_SECRET: randomBytes(TAMANHO_MINIMO_JWT_SECRET).toString('base64url') };
}
