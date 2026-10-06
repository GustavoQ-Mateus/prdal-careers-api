import { Body, Controller, HttpCode, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ACOES_RAPIDAS, EVENTOS_TELEMETRIA, SESSAO_ID_PADRAO, TelemetriaEventoDto } from './telemetria.dto';

@ApiCookieAuth('prdal_access')
@UseGuards(JwtAuthGuard)
@Controller('telemetria')
export class TelemetriaController {
  @Post('eventos')
  @HttpCode(204)
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
    void user;
    void dto;
  }
}
