import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('curriculos/:id/docx')
  async docx(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.curriculos.arquivo(user.userId, id, 'docx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="curriculo.docx"');
    res.send(buffer);
  }

  @Get('curriculos/:id/pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.curriculos.arquivo(user.userId, id, 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="curriculo.pdf"');
    res.send(buffer);
  }
}
