import type { INestApplication, LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { comRequestId, HEADER_REQUEST_ID, requestIdDe } from './contexto';
import { emDesligamento, inicioRequisicao } from './desligamento';
import { responderErro } from './erros';

const ROTAS_SILENCIOSAS = new Set(['/health', '/ready']);

export function middlewareRequisicao(logger: LoggerService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = requestIdDe(req.headers[HEADER_REQUEST_ID.toLowerCase()]);
    res.setHeader(HEADER_REQUEST_ID, requestId);
    const inicio = process.hrtime.bigint();
    const terminar = inicioRequisicao();
    const rota = req.originalUrl.split('?')[0];
    res.on('close', () => {
      terminar();
      if (ROTAS_SILENCIOSAS.has(rota)) return;
      logger.log(
        {
          mensagem: 'requisicao',
          requestId,
          metodo: req.method,
          rota,
          status: res.statusCode,
          duracaoMs: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
          concluida: res.writableFinished,
        },
        'Http',
      );
    });
    if (emDesligamento()) {
      res.setHeader('Connection', 'close');
      comRequestId(requestId, () =>
        responderErro(res, 503, 'servico_indisponivel', 'O servidor está reiniciando. Tente de novo em instantes.'),
      );
      return;
    }
    comRequestId(requestId, () => next());
  };
}

export function reentrarContexto(_req: Request, res: Response, next: NextFunction): void {
  comRequestId(res.getHeader(HEADER_REQUEST_ID) as string, () => next());
}

export function configurarRequisicoes(app: INestApplication, logger: LoggerService): void {
  app.use(middlewareRequisicao(logger));
}

export function configurarContexto(app: INestApplication): void {
  app.use(reentrarContexto);
}
