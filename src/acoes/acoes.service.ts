import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarAcaoDto, CriarAcaoDto } from './acao.dto';

@Injectable()
export class AcoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly oportunidades: OportunidadesService,
  ) {}

  async listar(usuarioId: string, vagaId: string) {
    await this.oportunidades.garantirVaga(usuarioId, vagaId);
    return this.prisma.acaoOportunidade.findMany({
      where: { usuarioId, vagaId },
      orderBy: [{ principal: 'desc' }, { venceEm: 'asc' }, { criadoEm: 'desc' }],
    });
  }

  async criar(usuarioId: string, vagaId: string, dto: CriarAcaoDto) {
    await this.oportunidades.garantirVaga(usuarioId, vagaId);
    this.validarDatas(dto.venceEm, dto.lembrarEm);
    const venceEm = dto.venceEm ? new Date(dto.venceEm) : null;
    const lembrarEm = dto.lembrarEm ? new Date(dto.lembrarEm) : null;
    const principal = dto.principal ?? true;

    return this.prisma.$transaction(async (tx) => {
      if (principal) {
        await tx.acaoOportunidade.updateMany({
          where: {
            vagaId,
            principal: true,
            concluidaEm: null,
            canceladaEm: null,
          },
          data: { principal: false },
        });
      }
      const acao = await tx.acaoOportunidade.create({
        data: {
          usuarioId,
          vagaId,
          candidaturaId: dto.candidaturaId ?? null,
          titulo: dto.titulo,
          tipo: dto.tipo,
          principal,
          venceEm,
          lembrarEm,
        },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId,
        candidaturaId: acao.candidaturaId,
        tipo: 'ACAO_CRIADA',
        origem: 'SISTEMA',
        descricao: 'Acao criada',
        dados: { acaoId: acao.id, tipo: acao.tipo },
      });
      return acao;
    });
  }

  async atualizar(usuarioId: string, id: string, dto: AtualizarAcaoDto) {
    const acao = await this.buscarDoUsuario(usuarioId, id);
    if (acao.concluidaEm || acao.canceladaEm) {
      throw new BadRequestException('acao encerrada nao pode ser editada');
    }
    const venceEm =
      dto.venceEm === undefined
        ? acao.venceEm
        : dto.venceEm
          ? new Date(dto.venceEm)
          : null;
    const lembrarEm =
      dto.lembrarEm === undefined
        ? acao.lembrarEm
        : dto.lembrarEm
          ? new Date(dto.lembrarEm)
          : null;
    this.validarDatas(venceEm?.toISOString(), lembrarEm?.toISOString());
    const reagendou =
      (venceEm?.getTime() ?? null) !== (acao.venceEm?.getTime() ?? null) ||
      (lembrarEm?.getTime() ?? null) !== (acao.lembrarEm?.getTime() ?? null);

    return this.prisma.$transaction(async (tx) => {
      if (dto.principal === true) {
        await tx.acaoOportunidade.updateMany({
          where: {
            vagaId: acao.vagaId,
            principal: true,
            concluidaEm: null,
            canceladaEm: null,
            id: { not: id },
          },
          data: { principal: false },
        });
      }
      const atualizada = await tx.acaoOportunidade.update({
        where: { id },
        data: {
          ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          ...(dto.principal !== undefined ? { principal: dto.principal } : {}),
          ...(dto.venceEm !== undefined ? { venceEm } : {}),
          ...(dto.lembrarEm !== undefined ? { lembrarEm } : {}),
        },
      });
      if (reagendou) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: acao.vagaId,
          candidaturaId: acao.candidaturaId,
          tipo: 'ACAO_REAGENDADA',
          origem: 'SISTEMA',
          descricao: 'Acao reagendada',
          dados: { acaoId: id },
        });
      }
      return atualizada;
    });
  }

  async concluir(usuarioId: string, id: string) {
    const acao = await this.buscarDoUsuario(usuarioId, id);
    if (acao.concluidaEm || acao.canceladaEm) {
      throw new BadRequestException('acao ja encerrada');
    }
    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.acaoOportunidade.update({
        where: { id },
        data: { concluidaEm: new Date(), principal: false },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: acao.vagaId,
        candidaturaId: acao.candidaturaId,
        tipo: 'ACAO_CONCLUIDA',
        origem: 'SISTEMA',
        descricao: 'Acao concluida',
        dados: { acaoId: id },
      });
      return atualizada;
    });
  }

  async cancelar(usuarioId: string, id: string) {
    const acao = await this.buscarDoUsuario(usuarioId, id);
    if (acao.concluidaEm || acao.canceladaEm) {
      throw new BadRequestException('acao ja encerrada');
    }
    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.acaoOportunidade.update({
        where: { id },
        data: { canceladaEm: new Date(), principal: false },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: acao.vagaId,
        candidaturaId: acao.candidaturaId,
        tipo: 'ACAO_CANCELADA',
        origem: 'SISTEMA',
        descricao: 'Acao cancelada',
        dados: { acaoId: id },
      });
      return atualizada;
    });
  }

  private async buscarDoUsuario(usuarioId: string, id: string) {
    const acao = await this.prisma.acaoOportunidade.findFirst({
      where: { id, usuarioId },
    });
    if (!acao) throw new NotFoundException('acao nao encontrada');
    return acao;
  }

  private validarDatas(venceEm?: string | null, lembrarEm?: string | null) {
    if (venceEm && lembrarEm && new Date(lembrarEm) > new Date(venceEm)) {
      throw new BadRequestException('lembrarEm nao pode ser posterior a venceEm');
    }
  }
}
