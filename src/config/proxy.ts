import type { NestExpressApplication } from '@nestjs/platform-express';

export function saltosDeProxy(env: Record<string, string | undefined> = process.env): number {
  const saltos = Number(env.TRUST_PROXY ?? '');
  return Number.isInteger(saltos) && saltos > 0 ? saltos : 0;
}

export function configurarProxy(app: NestExpressApplication, env: Record<string, string | undefined> = process.env): void {
  app.set('trust proxy', saltosDeProxy(env) || false);
}
