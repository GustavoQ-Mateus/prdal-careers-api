import type { Server } from 'node:http';

const IDLE_BALANCEADOR_PADRAO_S = 60;
const FOLGA_KEEPALIVE_MS = 5_000;
const FOLGA_CABECALHOS_MS = 1_000;

export interface TemposServidor {
  keepAliveTimeout: number;
  headersTimeout: number;
}

function numero(valor: string | undefined): number | null {
  if (valor === undefined || valor.trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function temposServidor(env: Record<string, string | undefined> = process.env): TemposServidor {
  const idleMs = (numero(env.BALANCEADOR_IDLE_S) ?? IDLE_BALANCEADOR_PADRAO_S) * 1000;
  const keepAliveTimeout = numero(env.HTTP_KEEPALIVE_TIMEOUT_MS) ?? idleMs + FOLGA_KEEPALIVE_MS;
  const headersTimeout = numero(env.HTTP_HEADERS_TIMEOUT_MS) ?? keepAliveTimeout + FOLGA_CABECALHOS_MS;
  if (keepAliveTimeout <= idleMs) {
    throw new Error(`HTTP_KEEPALIVE_TIMEOUT_MS (${keepAliveTimeout}) precisa ser maior que o idle do balanceador (${idleMs} ms)`);
  }
  if (headersTimeout <= keepAliveTimeout) {
    throw new Error(`HTTP_HEADERS_TIMEOUT_MS (${headersTimeout}) precisa ser maior que HTTP_KEEPALIVE_TIMEOUT_MS (${keepAliveTimeout})`);
  }
  return { keepAliveTimeout, headersTimeout };
}

export function configurarServidor(servidor: Server, env: Record<string, string | undefined> = process.env): TemposServidor {
  const tempos = temposServidor(env);
  servidor.keepAliveTimeout = tempos.keepAliveTimeout;
  servidor.headersTimeout = tempos.headersTimeout;
  return tempos;
}
