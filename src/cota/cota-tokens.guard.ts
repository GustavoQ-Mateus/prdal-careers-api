import {
  applyDecorators,
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { responderErro } from '../observabilidade/erros';
import { CotaTokensEsgotada, CotaTokensService, MENSAGEM_COTA_ESGOTADA } from './cota-tokens.service';

@Injectable()
export class CotaTokensGuard implements CanActivate {
  constructor(private readonly cota: CotaTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const usuarioId: string | undefined = context.switchToHttp().getRequest().user?.userId;
    if (usuarioId) await this.cota.verificar(usuarioId);
    return true;
  }
}

@Catch(CotaTokensEsgotada)
export class CotaTokensFiltro implements ExceptionFilter {
  catch(erro: CotaTokensEsgotada, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    res.header('Retry-After', String(erro.retryAfterSegundos));
    responderErro(res, erro.getStatus(), 'cota_tokens_esgotada', MENSAGEM_COTA_ESGOTADA, { retryAfter: erro.retryAfterSegundos });
  }
}

export function ExigirCotaTokens() {
  return applyDecorators(UseGuards(CotaTokensGuard));
}
