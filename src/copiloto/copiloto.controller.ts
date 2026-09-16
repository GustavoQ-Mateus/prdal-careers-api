import {
  Body,
  Controller,
  Headers,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesService } from './capacidades.service';
import { ChatService } from './chat.service';
import {
  ChatDto,
  KeywordsPreviaDto,
  MensagemRecrutadorDto,
  RagConsultaDto,
  RespostasFormularioDto,
  ScoreAvulsoDto,
} from './copiloto.dto';

@UseGuards(JwtAuthGuard)
@Controller('copiloto')
export class CopilotoController {
  constructor(
    private readonly chat: ChatService,
    private readonly capacidades: CapacidadesService,
  ) {}

  @Post('chat')
  async chatSse(
    @CurrentUser() user: AuthUser,
    @Headers('authorization') authHeader: string,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    await this.chat.chat(res, user, authHeader, dto);
  }

  @Post('keywords-previa')
  keywordsPrevia(@Body() dto: KeywordsPreviaDto) {
    return this.capacidades.keywordsPrevia(dto.descricao);
  }

  @Post('rag/consulta')
  ragConsulta(@CurrentUser() user: AuthUser, @Body() dto: RagConsultaDto) {
    return this.capacidades.consultarRag(user.userId, dto.query, dto.k);
  }

  @Post('score')
  score(@CurrentUser() user: AuthUser, @Body() dto: ScoreAvulsoDto) {
    return this.capacidades.score(
      user.userId,
      dto.markdown,
      dto.oportunidadeId,
      dto.keywords,
    );
  }

  @Post('mensagem-recrutador')
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
