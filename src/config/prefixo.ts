import { RequestMethod, type INestApplication } from '@nestjs/common';

export const VERSAO_API_PADRAO = 'v1';

function segmento(valor: string | undefined): string {
  return (valor ?? '').trim().replace(/^\/+|\/+$/g, '');
}

export function versaoApi(env: Record<string, string | undefined> = process.env): string {
  return env.API_VERSAO === undefined ? VERSAO_API_PADRAO : segmento(env.API_VERSAO);
}

export function prefixoApi(env: Record<string, string | undefined> = process.env): string {
  const partes = [segmento(env.API_PREFIXO), versaoApi(env)].filter(Boolean);
  return partes.length ? `/${partes.join('/')}` : '';
}

export function semPrefixo(caminho: string, env: Record<string, string | undefined> = process.env): string | null {
  const prefixo = prefixoApi(env);
  if (!prefixo) return caminho;
  return caminho.startsWith(`${prefixo}/`) ? caminho.slice(prefixo.length) : null;
}

export function configurarPrefixo(app: INestApplication, env: Record<string, string | undefined> = process.env): void {
  const prefixo = prefixoApi(env);
  if (prefixo) {
    app.setGlobalPrefix(prefixo, {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'ready', method: RequestMethod.GET },
      ],
    });
  }
}
