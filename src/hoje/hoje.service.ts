import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  adicionarDiasCivis,
  dataCivil,
  fusoValido,
  limitesDoDia,
} from '../dominio/fuso';
import { apresentacaoRelacional } from '../dominio/apresentacao';
import {
  agregarSerieTemporal,
  periodoValido,
  type SerieTemporal,
} from './hoje.agregacao';

export type HojeResposta = {
  fusoHorario: string;
  inicioDia: Date;
  fimDia: Date;
  atrasadas: unknown[];
  hoje: unknown[];
  proximosDias: unknown[];
  semProximoPasso: { id: string; titulo: string; empresa: string }[];
  atividadeRecente: unknown[];
  resumoAts: { curriculos: number; comScore: number; media: number | null };
  serieTemporal: SerieTemporal;
};

@Injectable()
export class HojeService {
  constructor(private readonly prisma: PrismaService) {}

  async preferencias(usuarioId: string, fusoDetectado?: string) {
    return this.garantirPreferencia(usuarioId, fusoDetectado);
  }

  async atualizar(usuarioId: string, fusoHorario?: string) {
    if (fusoHorario && !fusoValido(fusoHorario)) {
      throw new BadRequestException('fuso horario IANA invalido');
    }
    const atual = await this.garantirPreferencia(usuarioId, fusoHorario);
    if (!fusoHorario) return atual;
    return this.prisma.preferenciaUsuario.update({
      where: { usuarioId },
      data: { fusoHorario },
    });
  }

  async agenda(usuarioId: string, de?: string, ate?: string, periodo?: string): Promise<HojeResposta> {
    const pref = await this.garantirPreferencia(usuarioId);
    const fuso = pref.fusoHorario;
    const hoje = dataCivil(new Date(), fuso);
    const inicioCivil = de ?? hoje;
    const fimCivil = ate ?? adicionarDiasCivis(hoje, 7);
    const { inicio: inicioDia } = limitesDoDia(hoje, fuso);
    const { fim: fimDia } = limitesDoDia(hoje, fuso);
    const { inicio: inicioJanela } = limitesDoDia(inicioCivil, fuso);
    const { inicio: fimJanela } = limitesDoDia(
      adicionarDiasCivis(fimCivil, 1),
      fuso,
    );

    const acoes = await this.prisma.acaoOportunidade.findMany({
      where: {
        usuarioId,
        concluidaEm: null,
        canceladaEm: null,
        vaga: { arquivadaEm: null },
      },
      include: {
        vaga: { select: { id: true, titulo: true, empresa: true } },
      },
    });

    const atrasadas = [];
    const doDia = [];
    const proximosDias = [];
    for (const acao of acoes) {
      const ref = acao.lembrarEm ?? acao.venceEm;
      if (!ref) continue;
      const item = this.itemAcao(acao, ref);
      if (ref < inicioDia) atrasadas.push(item);
      else if (ref < fimDia) doDia.push(item);
      else if (ref >= inicioJanela && ref < fimJanela && ref >= fimDia) {
        proximosDias.push(item);
      }
    }

    const porData = (a: { quando: Date }, b: { quando: Date }) =>
      a.quando.getTime() - b.quando.getTime();
    atrasadas.sort(porData);
    doDia.sort(porData);
    proximosDias.sort(porData);

    const ativas = await this.prisma.vaga.findMany({
      where: { usuarioId, arquivadaEm: null },
      include: {
        candidaturas: { where: { principal: true } },
        acoes: {
          where: { principal: true, concluidaEm: null, canceladaEm: null },
        },
      },
    });
    const semProximoPasso = ativas
      .filter((v) => {
        const status = v.candidaturas[0]?.status ?? null;
        if (apresentacaoRelacional(v.arquivadaEm, status) !== 'ATIVA') return false;
        return v.acoes.length === 0;
      })
      .map((v) => ({
        id: v.id,
        titulo: v.titulo,
        empresa: v.empresa,
      }));

    const atividadeRecente = await this.prisma.eventoOportunidade.findMany({
      where: { usuarioId },
      orderBy: { ocorridoEm: 'desc' },
      take: 12,
      include: { vaga: { select: { titulo: true, empresa: true } } },
    });

    const curriculos = await this.prisma.curriculo.findMany({
      where: { vaga: { usuarioId } },
      select: { score: true },
    });
    const scores = curriculos
      .map((c) => c.score)
      .filter((s): s is number => s !== null);
    const resumoAts = {
      curriculos: curriculos.length,
      comScore: scores.length,
      media: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    };

    const periodoDias = periodoValido(periodo);
    const [oportunidades, acoesConcluidas, curriculosGerados] = await Promise.all([
      this.prisma.vaga.findMany({
        where: { usuarioId },
        select: { criadoEm: true },
      }),
      this.prisma.acaoOportunidade.findMany({
        where: { usuarioId, concluidaEm: { not: null } },
        select: { concluidaEm: true },
      }),
      this.prisma.curriculo.findMany({
        where: { vaga: { usuarioId } },
        select: { geradoEm: true, score: true },
      }),
    ]);
    const serieTemporal = agregarSerieTemporal({
      hoje,
      fuso,
      periodoDias,
      oportunidades: oportunidades.map((item) => ({ data: item.criadoEm })),
      acoesConcluidas: acoesConcluidas.flatMap((item) => item.concluidaEm ? [{ data: item.concluidaEm }] : []),
      curriculos: curriculosGerados.map((item) => ({ data: item.geradoEm, score: item.score })),
    });

    return {
      fusoHorario: fuso,
      inicioDia,
      fimDia,
      atrasadas,
      hoje: doDia,
      proximosDias,
      semProximoPasso,
      atividadeRecente: atividadeRecente.map((e) => ({
        id: e.id,
        vagaId: e.vagaId,
        titulo: e.vaga.titulo,
        empresa: e.vaga.empresa,
        tipo: e.tipo,
        descricao: e.descricao,
        ocorridoEm: e.ocorridoEm,
      })),
      resumoAts,
      serieTemporal,
    };
  }

  async garantirPreferencia(usuarioId: string, fusoDetectado?: string) {
    const atual = await this.prisma.preferenciaUsuario.findUnique({
      where: { usuarioId },
    });
    if (atual) return atual;
    const fuso =
      fusoDetectado && fusoValido(fusoDetectado)
        ? fusoDetectado
        : 'America/Sao_Paulo';
    return this.prisma.preferenciaUsuario.create({
      data: { usuarioId, fusoHorario: fuso },
    });
  }

  private itemAcao(
    acao: {
      id: string;
      vagaId: string;
      titulo: string;
      tipo: string;
      principal: boolean;
      venceEm: Date | null;
      lembrarEm: Date | null;
      vaga: { id: string; titulo: string; empresa: string };
    },
    quando: Date,
  ) {
    return {
      id: acao.id,
      vagaId: acao.vagaId,
      titulo: acao.titulo,
      tipo: acao.tipo,
      principal: acao.principal,
      venceEm: acao.venceEm,
      lembrarEm: acao.lembrarEm,
      quando,
      oportunidade: {
        id: acao.vaga.id,
        titulo: acao.vaga.titulo,
        empresa: acao.vaga.empresa,
      },
    };
  }
}
