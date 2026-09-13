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
import {
  AtualizarCandidaturaDto,
  CriarCandidaturaDto,
} from './candidatura.dto';
import { CandidaturasService } from './candidaturas.service';

@UseGuards(JwtAuthGuard)
@Controller('candidaturas')
export class CandidaturasController {
  constructor(private readonly candidaturas: CandidaturasService) {}

  @Post()
  criar(@CurrentUser() user: AuthUser, @Body() dto: CriarCandidaturaDto) {
    return this.candidaturas.criar(user.userId, dto);
  }

  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.candidaturas.listar(user.userId);
  }

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AtualizarCandidaturaDto,
  ) {
    return this.candidaturas.atualizar(user.userId, id, dto);
  }
}
