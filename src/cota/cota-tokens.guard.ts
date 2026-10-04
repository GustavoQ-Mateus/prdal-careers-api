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
import { CotaTokensEsgotada, CotaTokensService } from './cota-tokens.service';

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
    res
      .status(erro.getStatus())
      .header('Retry-After', String(erro.retryAfterSegundos))
      .json(erro.getResponse());
  }
}

export function ExigirCotaTokens() {
  return applyDecorators(UseGuards(CotaTokensGuard));
}
