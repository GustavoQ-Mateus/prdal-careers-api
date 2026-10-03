import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

export function configurarCabecalhos(app: NestExpressApplication): void {
  app.disable('x-powered-by');
  app.use(
    helmet({
      hsts: false,
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
      },
    }),
  );
  const hsts = process.env.PRDAL_HSTS?.trim();
  if (hsts) {
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Strict-Transport-Security', hsts);
      next();
    });
  }
}
