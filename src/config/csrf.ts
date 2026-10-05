import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { COOKIE_CSRF, HEADER_CSRF, lerCookie } from '../auth/cookies';
import { responderErro } from '../observabilidade/erros';
import { semPrefixo } from './prefixo';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ROTAS_ISENTAS = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function recusar(res: Response, codigo: string, mensagem: string): void {
  responderErro(res, 403, codigo, mensagem);
}

function deOutroSite(req: Request): boolean {
  const origem = req.headers['sec-fetch-site'];
  return typeof origem === 'string' && origem.trim().toLowerCase() === 'cross-site';
}

export function protecaoCsrf(req: Request, res: Response, next: NextFunction): void {
  if (METODOS_SEGUROS.has(req.method)) return next();
  if (ROTAS_ISENTAS.has(semPrefixo(req.path) ?? '')) {
    return deOutroSite(req) ? recusar(res, 'origem_recusada', 'requisicao de outro site recusada') : next();
  }
  const cookie = lerCookie(req, COOKIE_CSRF);
  const cabecalho = req.headers[HEADER_CSRF];
  if (cookie && typeof cabecalho === 'string' && iguais(cabecalho, cookie)) return next();
  recusar(res, 'csrf_invalido', 'token csrf ausente ou invalido');
}

export function configurarCsrf(app: NestExpressApplication): void {
  app.use(protecaoCsrf);
}
