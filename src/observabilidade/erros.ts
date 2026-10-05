import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { requestIdAtual } from './contexto';

export interface CorpoErro {
  erro: {
    codigo: string;
    mensagem: string;
    requestId: string | null;
    detalhes?: Record<string, unknown>;
  };
}

export interface RespostaExcecao {
  message: string | string[];
}

export const CODIGOS_POR_STATUS: Record<number, string> = {
  400: 'requisicao_invalida',
  401: 'nao_autenticado',
  403: 'acesso_negado',
  404: 'nao_encontrado',
  409: 'conflito',
  413: 'corpo_grande_demais',
  429: 'limite_de_requisicoes',
  500: 'erro_interno',
  502: 'dependencia_falhou',
  503: 'servico_indisponivel',
  504: 'tempo_esgotado',
};

export const MENSAGEM_ERRO_INTERNO = 'Erro interno. Informe o requestId se precisar de ajuda.';

export function codigoDoStatus(status: number): string {
  return CODIGOS_POR_STATUS[status] ?? (status >= 500 ? 'erro_interno' : 'requisicao_invalida');
}

export function corpoErro(codigo: string, mensagem: string, detalhes?: Record<string, unknown>, requestId = requestIdAtual()): CorpoErro {
  return { erro: { codigo, mensagem, requestId: requestId ?? null, ...(detalhes ? { detalhes } : {}) } };
}

export function responderErro(res: Response, status: number, codigo: string, mensagem: string, detalhes?: Record<string, unknown>): void {
  res.status(status).json(corpoErro(codigo, mensagem, detalhes, (res.getHeader('X-Request-Id') as string | undefined) ?? requestIdAtual()));
}

interface Traduzido {
  status: number;
  codigo: string;
  mensagem: string;
  detalhes?: Record<string, unknown>;
}

function mensagemDe(resposta: unknown, padrao: string): { texto: string; lista: boolean } {
  if (typeof resposta === 'string') return { texto: resposta, lista: false };
  const message = (resposta as Partial<RespostaExcecao> | null)?.message;
  if (Array.isArray(message)) return { texto: message.map(String).join('; '), lista: true };
  if (typeof message === 'string' && message) return { texto: message, lista: false };
  return { texto: padrao, lista: false };
}

export function traduzir(erro: unknown): Traduzido {
  if (!(erro instanceof HttpException)) {
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, codigo: 'erro_interno', mensagem: MENSAGEM_ERRO_INTERNO };
  }
  const status = erro.getStatus();
  const resposta = erro.getResponse();
  const { texto, lista } = mensagemDe(resposta, erro.message);
  const proprio = (resposta as { codigo?: unknown } | null)?.codigo;
  const retryAfter = (resposta as { retryAfter?: unknown } | null)?.retryAfter;
  const codigo =
    typeof proprio === 'string' && proprio
      ? proprio
      : erro instanceof ThrottlerException
        ? 'limite_de_requisicoes'
        : status === 400 && lista
          ? 'dados_invalidos'
          : codigoDoStatus(status);
  return {
    status,
    codigo,
    mensagem: status >= 500 && status !== 503 && status !== 504 ? MENSAGEM_ERRO_INTERNO : texto,
    ...(typeof retryAfter === 'number' ? { detalhes: { retryAfter } } : {}),
  };
}

@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger('Erros');

  catch(erro: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const traduzido = traduzir(erro);
    if (traduzido.status >= 500) {
      this.logger.error(
        { mensagem: (erro as Error)?.message ?? String(erro), codigo: traduzido.codigo, status: traduzido.status },
        (erro as Error)?.stack,
      );
    }
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    responderErro(res, traduzido.status, traduzido.codigo, traduzido.mensagem, traduzido.detalhes);
  }
}
