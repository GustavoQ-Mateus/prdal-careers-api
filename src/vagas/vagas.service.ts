import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiClient } from '../clients/ai.client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarVagaDto, CriarVagaDto } from './vaga.dto';

@Injectable()
export class VagasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClient,
  ) {}

  async criar(usuarioId: string, dto: CriarVagaDto) {
    const keywords = await this.aiClient.keywords(dto.descricao);
    return this.prisma.vaga.create({
      data: { ...dto, usuarioId, keywords: keywords as unknown as Prisma.InputJsonValue },
    });
  }

  listar(usuarioId: string) {
    return this.prisma.vaga.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async buscar(usuarioId: string, id: string) {
    const vaga = await this.prisma.vaga.findFirst({ where: { id, usuarioId } });
    if (!vaga) throw new NotFoundException('vaga nao encontrada');
    return vaga;
  }

  async atualizar(usuarioId: string, id: string, dto: AtualizarVagaDto) {
    await this.buscar(usuarioId, id);
    const keywords = dto.descricao
      ? await this.aiClient.keywords(dto.descricao)
      : undefined;
    return this.prisma.vaga.update({
      where: { id },
      data: {
        ...dto,
        ...(keywords ? { keywords: keywords as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remover(usuarioId: string, id: string) {
    await this.buscar(usuarioId, id);
    await this.prisma.vaga.delete({ where: { id } });
  }
}
