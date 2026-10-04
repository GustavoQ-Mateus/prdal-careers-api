import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PipelineAtsService } from '../pipeline-ats/pipeline-ats.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilMestreDto } from './perfil.dto';
import { normalizarPerfil, perfilParaPersistencia } from './perfil.normalizacao';

@Injectable()
export class PerfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineAts: PipelineAtsService,
  ) {}

  async buscar(usuarioId: string) {
    const perfil = await this.prisma.perfilMestre.findUnique({ where: { usuarioId } });
    return perfil ? normalizarPerfil(perfil) : null;
  }

  async salvar(usuarioId: string, dto: PerfilMestreDto) {
    const perfil = perfilParaPersistencia(normalizarPerfil(dto));
    const json = (valor: unknown) => valor as Prisma.InputJsonValue;
    const dados = {
      nome: perfil.nome,
      contato: json(perfil.contato),
      resumo: perfil.resumo,
      experiencias: json(perfil.experiencias),
      formacao: json(perfil.formacao),
      certificacoes: json(perfil.certificacoes),
      idiomas: json(perfil.idiomas),
      skills: json(perfil.skills),
    };
    const salvo = await this.prisma.$transaction(async (tx) => {
      const gravado = await tx.perfilMestre.upsert({
        where: { usuarioId },
        create: { usuarioId, ...dados },
        update: dados,
      });
      await this.pipelineAts.perfilAlterado(usuarioId, tx);
      return gravado;
    });
    return normalizarPerfil(salvo);
  }
}
