import { applyDecorators, ArgumentsHost, CanActivate, Catch, ExceptionFilter, ExecutionContext, ForbiddenException, Injectable, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { responderErro } from '../observabilidade/erros';
import { PrismaService } from '../prisma/prisma.service';

export const MENSAGEM_CONSENTIMENTO = 'Aceite o envio dos seus dados ao provedor de IA antes de continuar.';

export class ConsentimentoPendente extends ForbiddenException {
  constructor() {
    super({ codigo: 'consentimento_pendente', message: MENSAGEM_CONSENTIMENTO });
  }
}

@Injectable()
export class ConsentimentoGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const usuarioId: string | undefined = context.switchToHttp().getRequest().user?.userId;
    if (!usuarioId) return true;
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { consentimentoLlmEm: true } });
    if (!usuario?.consentimentoLlmEm) throw new ConsentimentoPendente();
    return true;
  }
}

@Catch(ConsentimentoPendente)
export class ConsentimentoFiltro implements ExceptionFilter {
  catch(erro: ConsentimentoPendente, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    responderErro(res, erro.getStatus(), 'consentimento_pendente', MENSAGEM_CONSENTIMENTO);
  }
}

export function ExigirConsentimento() {
  return applyDecorators(UseGuards(ConsentimentoGuard));
}
