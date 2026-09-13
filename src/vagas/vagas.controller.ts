import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurriculosService } from '../curriculos/curriculos.service';
import { AtualizarVagaDto, CriarVagaDto } from './vaga.dto';
import { VagasService } from './vagas.service';

@UseGuards(JwtAuthGuard)
@Controller('vagas')
export class VagasController {
  constructor(
    private readonly vagas: VagasService,
    private readonly curriculos: CurriculosService,
  ) {}

  @Post()
  criar(@CurrentUser() user: AuthUser, @Body() dto: CriarVagaDto) {
    return this.vagas.criar(user.userId, dto);
  }

  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.vagas.listar(user.userId);
  }

  @Get(':id')
  buscar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vagas.buscar(user.userId, id);
  }

  @Get(':id/curriculos')
  listarCurriculos(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.listarPorVaga(user.userId, id);
  }

  @Put(':id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AtualizarVagaDto,
  ) {
    return this.vagas.atualizar(user.userId, id, dto);
  }

  @Delete(':id')
  remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vagas.remover(user.userId, id);
  }

  @Post(':id/gerar-cv')
  @HttpCode(202)
  gerarCv(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.gerar(user.userId, id);
  }
}
