import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiResponse } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesService } from './capacidades.service';
import { ChatService } from './chat.service';
import { ConversasService } from './conversas.service';
import { TurnosService } from './turnos.service';
import {
  ChatDto,
  MensagemRecrutadorDto,
  RespostasFormularioDto,
} from './copiloto.dto';
import { LIMITES, LimitarRequisicoes } from '../limites/limite-requisicoes';
import { ExigirCotaTokens } from '../cota/cota-tokens.guard';
import { ExigirConsentimento } from '../conta/consentimento.guard';

@UseGuards(JwtAuthGuard)
@Controller('copiloto')
export class CopilotoController {
  constructor(
    private readonly chat: ChatService,
    private readonly capacidades: CapacidadesService,
    private readonly conversas: ConversasService,
    private readonly turnos: TurnosService,
  ) {}

  @Get('conversas')
  listarConversas(
    @CurrentUser() user: AuthUser,
    @Query('oportunidadeId') oportunidadeId?: string,
  ) {
    return this.conversas.listar(user.userId, oportunidadeId);
  }

  @Get('conversas/:id')
  buscarConversa(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversas.buscar(user.userId, id);
  }

  @Post('chat')
  @ApiResponse({ status: 201, content: { 'text/event-stream': { schema: { type: 'string' } } } })
  @ExigirConsentimento()
  @LimitarRequisicoes(LIMITES.chat)
  async chatSse(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    await this.chat.chat(res, user, dto, async (conversaId) => this.turnos.manter(await this.turnos.exigir(conversaId)));
  }

  @Post('mensagem-recrutador')
  @ExigirConsentimento()
  @LimitarRequisicoes(LIMITES.ia)
  @ExigirCotaTokens()
  mensagemRecrutador(
    @CurrentUser() user: AuthUser,
    @Body() dto: MensagemRecrutadorDto,
  ) {
    return this.capacidades.mensagemRecrutador(
      user.userId,
      dto.oportunidadeId,
      dto.contexto,
    );
  }

  @Post('respostas-formulario')
  @ExigirConsentimento()
  @LimitarRequisicoes(LIMITES.ia)
  @ExigirCotaTokens()
  respostasFormulario(
    @CurrentUser() user: AuthUser,
    @Body() dto: RespostasFormularioDto,
  ) {
    return this.capacidades.respostasFormulario(
      user.userId,
      dto.oportunidadeId,
      dto.campos,
    );
  }
}
