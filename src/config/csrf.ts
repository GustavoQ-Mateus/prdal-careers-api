import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { COOKIE_CSRF, HEADER_CSRF, lerCookie } from '../auth/cookies';
import { semPrefixo } from './prefixo';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ROTAS_ISENTAS = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function protecaoCsrf(req: Request, res: Response, next: NextFunction): void {
  if (METODOS_SEGUROS.has(req.method) || ROTAS_ISENTAS.has(semPrefixo(req.path) ?? '')) return next();
  const cookie = lerCookie(req, COOKIE_CSRF);
  const cabecalho = req.headers[HEADER_CSRF];
  if (cookie && typeof cabecalho === 'string' && iguais(cabecalho, cookie)) return next();
  res.status(403).json({ statusCode: 403, message: 'token csrf ausente ou invalido', error: 'Forbidden' });
}

export function configurarCsrf(app: NestExpressApplication): void {
  app.use(protecaoCsrf);
}
