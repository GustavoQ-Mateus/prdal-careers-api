import { Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContaService } from './conta.service';

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
}
