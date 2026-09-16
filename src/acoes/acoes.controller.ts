import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AtualizarAcaoDto, CriarAcaoDto } from './acao.dto';
import { AcoesService } from './acoes.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class AcoesController {
  constructor(private readonly acoes: AcoesService) {}

  @Get('oportunidades/:id/acoes')
  listar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.acoes.listar(user.userId, id);
  }

  @Post('oportunidades/:id/acoes')
  criar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CriarAcaoDto,
  ) {
    return this.acoes.criar(user.userId, id, dto);
  }

  @Patch('acoes/:id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AtualizarAcaoDto,
  ) {
    return this.acoes.atualizar(user.userId, id, dto);
  }

  @Post('acoes/:id/concluir')
  concluir(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.acoes.concluir(user.userId, id);
  }

  @Post('acoes/:id/cancelar')
  cancelar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.acoes.cancelar(user.userId, id);
  }
}
