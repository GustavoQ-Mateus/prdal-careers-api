import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AtualizarCandidaturaDto,
  CriarCandidaturaDto,
} from './candidatura.dto';

@Injectable()
export class CandidaturasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(usuarioId: string, dto: CriarCandidaturaDto) {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: dto.vagaId, usuarioId },
    });
    if (!vaga) throw new NotFoundException('vaga nao encontrada');

    return this.prisma.candidatura.create({
      data: { vagaId: dto.vagaId, curriculoId: dto.curriculoId ?? null },
    });
  }

  async listar(usuarioId: string) {
    const candidaturas = await this.prisma.candidatura.findMany({
      where: { vaga: { usuarioId } },
      include: { vaga: { select: { titulo: true, empresa: true } } },
      orderBy: { atualizadoEm: 'desc' },
    });
    return candidaturas.map((c) => ({
      id: c.id,
      vagaId: c.vagaId,
      tituloVaga: c.vaga.titulo,
      empresa: c.vaga.empresa,
      curriculoId: c.curriculoId,
      status: c.status,
      notas: c.notas,
      atualizadoEm: c.atualizadoEm,
    }));
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarCandidaturaDto,
  ) {
    const candidatura = await this.prisma.candidatura.findFirst({
      where: { id, vaga: { usuarioId } },
    });
    if (!candidatura) throw new NotFoundException('candidatura nao encontrada');

    return this.prisma.candidatura.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notas !== undefined ? { notas: dto.notas } : {}),
        ...(dto.curriculoId !== undefined
          ? { curriculoId: dto.curriculoId }
          : {}),
      },
    });
  }
}
