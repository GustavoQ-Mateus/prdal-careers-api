import { Injectable, NotFoundException } from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarVagaDto, CriarVagaDto } from './vaga.dto';

@Injectable()
export class VagasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly jobs: JobsService,
  ) {}

  async criar(usuarioId: string, dto: CriarVagaDto) {
    const { vaga, job } = await this.prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.create({
        data: {
          ...dto,
          usuarioId,
          keywords: [],
          keywordsStatus: 'PENDENTE',
          keywordsExtracao: 'PENDENTE',
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
      const job = await this.jobs.criar(tx, { tipo: 'extrair_keywords', usuarioId, referenciaId: vaga.id });
      return { vaga, job };
    });
    await this.jobs.enfileirar([job]);
    return vaga;
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
    const atual = await this.buscar(usuarioId, id);
    const extrair = dto.descricao !== undefined && dto.descricao !== atual.descricao;
    const { vaga, job } = await this.prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.update({
        where: { id },
        data: {
          ...dto,
          ...(extrair ? { keywordsStatus: 'PENDENTE', keywordsExtracao: 'PENDENTE', keywordsErro: null } : {}),
        },
      });
      const job = extrair ? await this.jobs.criar(tx, { tipo: 'extrair_keywords', usuarioId, referenciaId: id }) : null;
      return { vaga, job };
    });
    if (job) await this.jobs.enfileirar([job]);
    return vaga;
  }

  async remover(usuarioId: string, id: string) {
    await this.buscar(usuarioId, id);
    await this.prisma.vaga.delete({ where: { id } });
  }
}
