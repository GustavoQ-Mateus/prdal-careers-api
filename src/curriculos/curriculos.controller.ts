import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurriculosService } from './curriculos.service';

@UseGuards(JwtAuthGuard)
@Controller('curriculos')
export class CurriculosController {
  constructor(private readonly curriculos: CurriculosService) {}

  @Get(':id')
  buscar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.buscar(user.userId, id);
  }

  @Get(':id/docx')
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

  @Get(':id/pdf')
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
