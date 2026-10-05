import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { responderErro } from '../observabilidade/erros';

export const LIMITE_CORPO_PADRAO = '1mb';

export function configurarCorpo(app: NestExpressApplication): void {
  const limite = process.env.API_BODY_LIMIT?.trim() || LIMITE_CORPO_PADRAO;
  app.useBodyParser('json', { limit: limite });
  app.useBodyParser('urlencoded', { limit: limite, extended: true });
  app.use((erro: { type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (erro?.type !== 'entity.too.large') return next(erro);
    responderErro(res, 413, 'corpo_grande_demais', `corpo da requisicao acima do limite de ${limite}`);
  });
}
