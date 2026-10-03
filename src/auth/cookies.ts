import type { CookieOptions, Request, Response } from 'express';

export const COOKIE_ACESSO = 'prdal_access';
export const COOKIE_REFRESH = 'prdal_refresh';
export const COOKIE_CSRF = 'prdal_csrf';
export const HEADER_CSRF = 'x-csrf-token';
export const CAMINHO_REFRESH = '/auth/refresh';
export const ACESSO_TTL_MS = 15 * 60 * 1000;

export function refreshTtlMs(): number {
  const dias = Number(process.env.REFRESH_TTL_DIAS);
  return (Number.isFinite(dias) && dias > 0 ? dias : 7) * 24 * 60 * 60 * 1000;
}

function seguro(): boolean {
  return ['1', 'true', 'sim'].includes((process.env.PRDAL_HTTPS ?? '').trim().toLowerCase());
}

function base(httpOnly: boolean, path: string, maxAge: number): CookieOptions {
  return { httpOnly, sameSite: 'lax', secure: seguro(), path, maxAge };
}

export function lerCookies(cabecalho: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const parte of (cabecalho ?? '').split(';')) {
    const igual = parte.indexOf('=');
    if (igual <= 0) continue;
    const nome = parte.slice(0, igual).trim();
    const valor = parte.slice(igual + 1).trim();
    try {
      cookies[nome] = decodeURIComponent(valor);
    } catch {
      cookies[nome] = valor;
    }
  }
  return cookies;
}

export function lerCookie(req: Request, nome: string): string | undefined {
  return lerCookies(req.headers.cookie)[nome];
}

export function gravarSessao(
  res: Response,
  credenciais: { acesso: string; refresh: string; csrf: string },
): void {
  res.cookie(COOKIE_ACESSO, credenciais.acesso, base(true, '/', ACESSO_TTL_MS));
  res.cookie(COOKIE_REFRESH, credenciais.refresh, base(true, CAMINHO_REFRESH, refreshTtlMs()));
  res.cookie(COOKIE_CSRF, credenciais.csrf, base(false, '/', refreshTtlMs()));
}

export function gravarCsrf(res: Response, csrf: string): void {
  res.cookie(COOKIE_CSRF, csrf, base(false, '/', refreshTtlMs()));
}

export function limparSessao(res: Response): void {
  const { maxAge: _acesso, ...acesso } = base(true, '/', 0);
  const { maxAge: _refresh, ...refresh } = base(true, CAMINHO_REFRESH, 0);
  const { maxAge: _csrf, ...csrf } = base(false, '/', 0);
  res.clearCookie(COOKIE_ACESSO, acesso);
  res.clearCookie(COOKIE_REFRESH, refresh);
  res.clearCookie(COOKIE_CSRF, csrf);
}
