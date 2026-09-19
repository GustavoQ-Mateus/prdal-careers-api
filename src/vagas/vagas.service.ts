import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiClient } from '../clients/ai.client';
import { EventosService } from '../eventos/eventos.service';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarVagaDto, CriarVagaDto } from './vaga.dto';

@Injectable()
export class VagasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClient,
    private readonly eventos: EventosService,
  ) {}

  async criar(usuarioId: string, dto: CriarVagaDto) {
    const extracao = await this.aiClient.keywords(dto.descricao);
    return this.prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.create({
        data: {
          ...dto,
          usuarioId,
          keywords: extracao.keywords as unknown as Prisma.InputJsonValue,
          keywordsStatus: extracao.status,
        },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: vaga.id,
        tipo: 'OPORTUNIDADE_CRIADA',
        origem: 'SISTEMA',
        descricao: 'Oportunidade registrada',
        dados: { origem: 'MANUAL' },
      });
      return vaga;
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
    const extracao = dto.descricao !== undefined
      ? await this.aiClient.keywords(dto.descricao)
      : undefined;
    return this.prisma.vaga.update({
      where: { id },
      data: {
        ...dto,
        ...(extracao
          ? {
              keywords: extracao.keywords as unknown as Prisma.InputJsonValue,
              keywordsStatus: extracao.status,
            }
          : {}),
      },
    });
  }

  async remover(usuarioId: string, id: string) {
    await this.buscar(usuarioId, id);
    await this.prisma.vaga.delete({ where: { id } });
  }
}
