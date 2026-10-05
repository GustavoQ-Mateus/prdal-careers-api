import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EditarCurriculoDto } from './curriculo.dto';
import { CurriculosService } from './curriculos.service';

function numeroPaginacao(valor: string | undefined, nome: 'limit' | 'offset') {
  if (valor === undefined) return undefined;
  const numero = Number(valor);
  const minimo = nome === 'limit' ? 1 : 0;
  if (!Number.isInteger(numero) || numero < minimo) {
    throw new BadRequestException(`${nome} invalido`);
  }
  return numero;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class CurriculosController {
  constructor(private readonly curriculos: CurriculosService) {}

  @Get('curriculos')
  listar(
    @CurrentUser() user: AuthUser,
    @Query('vagaId') vagaId?: string,
    @Query('scoreMinimo') scoreMinimo?: string,
    @Query('vinculado') vinculado?: string,
    @Query('categoria') categoria?: string,
    @Query('nivel') nivel?: string,
    @Query('ordenarPor') ordenarPor?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.curriculos.listar(user.userId, {
      vagaId,
      scoreMinimo: scoreMinimo ? Number(scoreMinimo) : undefined,
      vinculado,
      categoria,
      nivel,
      ordenarPor,
      de,
      ate,
      limit: numeroPaginacao(limit, 'limit'),
      offset: numeroPaginacao(offset, 'offset'),
    });
  }

  @Get('geracoes-curriculo/:jobId')
  status(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.curriculos.statusGeracao(user.userId, jobId);
  }

  @Get('curriculos/:id')
  buscar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.buscar(user.userId, id);
  }

  @Put('curriculos/:id')
  editar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EditarCurriculoDto,
  ) {
    return this.curriculos.editar(user.userId, id, dto);
  }

  @Post('curriculos/:id/arquivos')
  gerarArquivos(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.gerarArquivos(user.userId, id);
  }

  @Get('curriculos/:id/docx')
  docx(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.arquivo(user.userId, id, 'docx');
  }

  @Get('curriculos/:id/pdf')
  pdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.arquivo(user.userId, id, 'pdf');
  }

  @Get('curriculos/:id/pacote')
  pacote(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.pacote(user.userId, id);
  }
}
