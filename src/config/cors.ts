import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const ORIGENS_DESENVOLVIMENTO = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function origensPermitidas(env: Record<string, string | undefined> = process.env): string[] {
  const lista = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origem) => origem.trim().replace(/\/+$/, ''))
    .filter((origem) => origem && origem !== '*');
  if (lista.length) return lista;
  return env.NODE_ENV === 'development' ? ORIGENS_DESENVOLVIMENTO : [];
}

export function opcoesCors(env: Record<string, string | undefined> = process.env): CorsOptions {
  return {
    origin: origensPermitidas(env),
    credentials: true,
    exposedHeaders: ['Retry-After'],
  };
}
