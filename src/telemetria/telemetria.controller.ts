import { Body, Controller, HttpCode, Logger, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LIMITES, LimitarRequisicoes } from '../limites/limite-requisicoes';
import { ACOES_RAPIDAS, EVENTOS_TELEMETRIA, SESSAO_ID_PADRAO, TelemetriaEventoDto } from './telemetria.dto';

@ApiCookieAuth('prdal_access')
@UseGuards(JwtAuthGuard)
@Controller('telemetria')
export class TelemetriaController {
  private readonly logger = new Logger(TelemetriaController.name);

  @Post('eventos')
  @HttpCode(204)
  @ApiNoContentResponse()
  @LimitarRequisicoes(LIMITES.telemetria)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBody({ schema: {
    oneOf: EVENTOS_TELEMETRIA.map((evento) => ({
      type: 'object',
      properties: {
        evento: { type: 'string', enum: [evento] },
        sessaoId: { type: 'string', minLength: 1, maxLength: 64, pattern: SESSAO_ID_PADRAO },
        acao: { type: 'string', enum: [...ACOES_RAPIDAS] },
      },
      required: evento === 'copiloto_acao_rapida' ? ['evento', 'sessaoId', 'acao'] : ['evento', 'sessaoId'],
    })),
  } })
  registrar(@CurrentUser() user: AuthUser, @Body() dto: TelemetriaEventoDto): void {
    this.logger.log({
      mensagem: 'evento de telemetria',
      telemetria: true,
      usuarioId: user.userId,
      evento: dto.evento,
      sessaoId: dto.sessaoId,
      acao: dto.acao ?? null,
    });
  }
}
