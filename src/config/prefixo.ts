import { RequestMethod, type INestApplication } from '@nestjs/common';

export function prefixoApi(env: Record<string, string | undefined> = process.env): string {
  const limpo = (env.API_PREFIXO ?? '').trim().replace(/^\/+|\/+$/g, '');
  return limpo ? `/${limpo}` : '';
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
