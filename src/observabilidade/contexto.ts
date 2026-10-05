import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const HEADER_REQUEST_ID = 'X-Request-Id';

const REQUEST_ID_VALIDO = /^[A-Za-z0-9._:-]{1,128}$/;

interface ContextoRequisicao {
  requestId: string;
}

const armazenamento = new AsyncLocalStorage<ContextoRequisicao>();

export function requestIdAtual(): string | undefined {
  return armazenamento.getStore()?.requestId;
}

export function requestIdDe(recebido: unknown): string {
  return typeof recebido === 'string' && REQUEST_ID_VALIDO.test(recebido) ? recebido : randomUUID();
}

export function comRequestId<T>(requestId: string, executar: () => T): T {
  return armazenamento.run({ requestId }, executar);
}

export function cabecalhoRequestId(): Record<string, string> {
  const requestId = requestIdAtual();
  return requestId ? { [HEADER_REQUEST_ID]: requestId } : {};
}
