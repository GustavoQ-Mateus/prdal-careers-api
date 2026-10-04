import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilMestreDto } from './perfil.dto';
import { normalizarPerfil, perfilParaPersistencia } from './perfil.normalizacao';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

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
    const salvo = await this.prisma.perfilMestre.upsert({
      where: { usuarioId },
      create: { usuarioId, ...dados },
      update: dados,
    });
    return normalizarPerfil(salvo);
  }
}
