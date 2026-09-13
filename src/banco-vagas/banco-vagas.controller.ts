import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportarBancoVagasDto } from './banco-vaga.dto';
import { BancoVagasService } from './banco-vagas.service';

@UseGuards(JwtAuthGuard)
@Controller('banco-vagas')
export class BancoVagasController {
  constructor(private readonly bancoVagas: BancoVagasService) {}

  @Post('import')
  importar(@CurrentUser() user: AuthUser, @Body() dto: ImportarBancoVagasDto) {
    return this.bancoVagas.importar(user.userId, dto);
  }

  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.bancoVagas.listar(user.userId);
  }

  @Post(':id/ativar')
  ativar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bancoVagas.ativar(user.userId, id);
  }
}
