import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotaObsidianRegistro } from './tipos';

@Injectable()
export class NotasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string): Promise<NotaObsidianRegistro[]> {
    return this.prisma.notaObsidian.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } });
  }
}
