import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AtualizarCandidaturaDto,
  CriarCandidaturaDto,
} from './candidatura.dto';

@Injectable()
export class CandidaturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
  ) {}

  async criar(usuarioId: string, dto: CriarCandidaturaDto) {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: dto.vagaId, usuarioId },
    });
    if (!vaga) throw new NotFoundException('vaga nao encontrada');
    await this.validarCurriculo(usuarioId, dto.vagaId, dto.curriculoId);

    return this.prisma.$transaction(async (tx) => {
      const criada = await tx.candidatura.create({
        data: {
          vagaId: dto.vagaId,
          curriculoId: dto.curriculoId ?? null,
          principal: false,
        },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: dto.vagaId,
        candidaturaId: criada.id,
        curriculoId: criada.curriculoId,
        tipo: 'CANDIDATURA_CRIADA',
        origem: 'SISTEMA',
        descricao: 'Candidatura registrada',
      });
      return criada;
    });
  }

  async listar(usuarioId: string) {
    const candidaturas = await this.prisma.candidatura.findMany({
      where: { vaga: { usuarioId } },
      include: {
        vaga: {
          select: {
            titulo: true,
            empresa: true,
            acoes: {
              where: { principal: true, concluidaEm: null, canceladaEm: null },
              take: 1,
            },
          },
        },
        curriculo: {
          select: { id: true, rotulo: true, score: true },
        },
      },
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
      principal: c.principal,
      atualizadoEm: c.atualizadoEm,
      curriculo: c.curriculo
        ? {
            id: c.curriculo.id,
            rotulo: c.curriculo.rotulo,
            score: c.curriculo.score,
          }
        : null,
      proximoPasso: c.vaga.acoes[0]
        ? {
            id: c.vaga.acoes[0].id,
            titulo: c.vaga.acoes[0].titulo,
            venceEm: c.vaga.acoes[0].venceEm,
          }
        : null,
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
    await this.validarCurriculo(
      usuarioId,
      candidatura.vagaId,
      dto.curriculoId,
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.candidatura.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.notas !== undefined ? { notas: dto.notas } : {}),
          ...(dto.curriculoId !== undefined
            ? { curriculoId: dto.curriculoId || null }
            : {}),
        },
      });
      if (dto.status && dto.status !== candidatura.status) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: candidatura.vagaId,
          candidaturaId: id,
          tipo: 'CANDIDATURA_STATUS',
          origem: 'SISTEMA',
          descricao: 'Status da candidatura alterado',
          dados: { de: candidatura.status, para: dto.status },
        });
      }
      if (
        dto.curriculoId !== undefined &&
        dto.curriculoId !== candidatura.curriculoId
      ) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: candidatura.vagaId,
          candidaturaId: id,
          curriculoId: dto.curriculoId,
          tipo: 'CURRICULO_VINCULADO',
          origem: 'SISTEMA',
          descricao: 'Vinculo de curriculo atualizado',
          dados: {
            anterior: candidatura.curriculoId,
            novo: dto.curriculoId,
          },
        });
      }
      return atualizada;
    });
  }

  private async validarCurriculo(
    usuarioId: string,
    vagaId: string,
    curriculoId?: string | null,
  ) {
    if (!curriculoId) return;
    const curriculo = await this.prisma.curriculo.findFirst({
      where: { id: curriculoId, vagaId, vaga: { usuarioId } },
    });
    if (!curriculo) {
      throw new BadRequestException(
        'curriculo nao pertence a esta oportunidade',
      );
    }
  }
}
