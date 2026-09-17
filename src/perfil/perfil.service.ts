import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilMestreDto } from './perfil.dto';
import { normalizarContato, normalizarExperiencias, normalizarPerfil } from './perfil.normalizacao';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(usuarioId: string) {
    const perfil = await this.prisma.perfilMestre.findUnique({ where: { usuarioId } });
    return perfil ? normalizarPerfil(perfil) : null;
  }

  async salvar(usuarioId: string, dto: PerfilMestreDto) {
    const dados = {
      nome: dto.nome,
      contato: normalizarContato(dto.contato) as unknown as Prisma.InputJsonValue,
      resumo: dto.resumo,
      experiencias: normalizarExperiencias(dto.experiencias) as unknown as Prisma.InputJsonValue,
      formacao: dto.formacao as Prisma.InputJsonValue,
      skills: dto.skills as Prisma.InputJsonValue,
    };
    const perfil = await this.prisma.perfilMestre.upsert({
      where: { usuarioId },
      create: { usuarioId, ...dados },
      update: dados,
    });
    return normalizarPerfil(perfil);
  }
}
