import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilMestreDto } from './perfil.dto';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  buscar(usuarioId: string) {
    return this.prisma.perfilMestre.findUnique({ where: { usuarioId } });
  }

  salvar(usuarioId: string, dto: PerfilMestreDto) {
    const dados = {
      nome: dto.nome,
      contato: dto.contato as Prisma.InputJsonValue,
      resumo: dto.resumo,
      experiencias: dto.experiencias as Prisma.InputJsonValue,
      formacao: dto.formacao as Prisma.InputJsonValue,
      skills: dto.skills as Prisma.InputJsonValue,
    };
    return this.prisma.perfilMestre.upsert({
      where: { usuarioId },
      create: { usuarioId, ...dados },
      update: dados,
    });
  }
}
