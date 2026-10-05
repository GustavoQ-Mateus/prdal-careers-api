import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
