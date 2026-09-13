import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerfilMestreDto } from './perfil.dto';
import { PerfilService } from './perfil.service';

@UseGuards(JwtAuthGuard)
@Controller('perfil-mestre')
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Get()
  buscar(@CurrentUser() user: AuthUser) {
    return this.perfil.buscar(user.userId);
  }

  @Put()
  salvar(@CurrentUser() user: AuthUser, @Body() dto: PerfilMestreDto) {
    return this.perfil.salvar(user.userId, dto);
  }
}
