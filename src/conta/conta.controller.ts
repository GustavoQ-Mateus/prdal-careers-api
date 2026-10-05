import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LIMITES, LimitarRequisicoes } from '../limites/limite-requisicoes';
import { ContaService } from './conta.service';
import { AgendarExclusaoDto } from './exclusao.dto';

@UseGuards(JwtAuthGuard)
@Controller('conta')
export class ContaController {
  constructor(private readonly conta: ContaService) {}

  @Get()
  buscar(@CurrentUser() user: AuthUser) {
    return this.conta.buscar(user.userId);
  }

  @Post('consentimento')
  @HttpCode(204)
  consentir(@CurrentUser() user: AuthUser) {
    return this.conta.consentir(user.userId);
  }

  @Delete('consentimento')
  @HttpCode(204)
  revogar(@CurrentUser() user: AuthUser) {
    return this.conta.revogar(user.userId);
  }

  @Post('exportacoes')
  @HttpCode(202)
  @LimitarRequisicoes(LIMITES.criacao)
  exportar(@CurrentUser() user: AuthUser) {
    return this.conta.exportar(user.userId);
  }

  @Get('exportacoes/:jobId')
  statusExportacao(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.conta.statusExportacao(user.userId, jobId);
  }

  @Post('exclusao')
  @HttpCode(200)
  @LimitarRequisicoes(LIMITES.login)
  agendarExclusao(@CurrentUser() user: AuthUser, @Body() dto: AgendarExclusaoDto) {
    return this.conta.agendarExclusao(user.userId, dto.senha);
  }

  @Delete('exclusao')
  @HttpCode(204)
  cancelarExclusao(@CurrentUser() user: AuthUser) {
    return this.conta.cancelarExclusao(user.userId);
  }
}
