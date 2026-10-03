import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { refreshTtlMs } from './cookies';

export interface CredenciaisSessao {
  acesso: string;
  refresh: string;
  csrf: string;
}

export interface PayloadAcesso {
  sub: string;
  email: string;
  sid: string;
}

export function hashRefresh(refresh: string): string {
  return createHash('sha256').update(refresh).digest('hex');
}

export function novoSegredo(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class SessoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async abrir(usuario: { id: string; email: string }, csrf = novoSegredo()): Promise<CredenciaisSessao> {
    const familia = randomUUID();
    const refresh = await this.registrarRefresh(usuario.id, familia);
    return { acesso: this.assinar(usuario, familia), refresh, csrf };
  }

  async renovar(refresh: string | undefined, csrf: string | undefined): Promise<CredenciaisSessao> {
    if (!refresh) throw new UnauthorizedException('sessao expirada');
    const agora = new Date();
    const sessao = await this.prisma.sessao.findUnique({
      where: { refreshHash: hashRefresh(refresh) },
      include: { usuario: { select: { id: true, email: true } } },
    });
    if (!sessao || sessao.revogadaEm || sessao.expiraEm <= agora) {
      throw new UnauthorizedException('sessao expirada');
    }
    const trocada = await this.prisma.sessao.updateMany({
      where: { id: sessao.id, substituidaEm: null, revogadaEm: null },
      data: { substituidaEm: agora, ultimoUsoEm: agora },
    });
    if (trocada.count === 0) {
      await this.revogarFamilia(sessao.familia);
      throw new UnauthorizedException('sessao expirada');
    }
    const novoRefresh = await this.registrarRefresh(sessao.usuarioId, sessao.familia);
    return {
      acesso: this.assinar(sessao.usuario, sessao.familia),
      refresh: novoRefresh,
      csrf: csrf || novoSegredo(),
    };
  }

  async revogarFamilia(familia: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { familia, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  async revogarTodas(usuarioId: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { usuarioId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  async familiaAtiva(familia: string, usuarioId: string): Promise<boolean> {
    const ativas = await this.prisma.sessao.count({
      where: { familia, usuarioId, revogadaEm: null, expiraEm: { gt: new Date() } },
    });
    return ativas > 0;
  }

  private assinar(usuario: { id: string; email: string }, familia: string): string {
    const payload: PayloadAcesso = { sub: usuario.id, email: usuario.email, sid: familia };
    return this.jwt.sign(payload);
  }

  private async registrarRefresh(usuarioId: string, familia: string): Promise<string> {
    const refresh = randomBytes(48).toString('base64url');
    await this.prisma.sessao.create({
      data: {
        usuarioId,
        familia,
        refreshHash: hashRefresh(refresh),
        expiraEm: new Date(Date.now() + refreshTtlMs()),
      },
    });
    return refresh;
  }
}
