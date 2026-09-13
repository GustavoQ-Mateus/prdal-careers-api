import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@CurrentUser() user: AuthUser) {
    const vagas = await this.prisma.vaga.findMany({
      where: { usuarioId: user.userId },
      select: {
        id: true,
        titulo: true,
        empresa: true,
        curriculos: { select: { score: true, geradoEm: true } },
      },
    });

    const linhas = vagas.map((vaga) => {
      const scores = vaga.curriculos
        .map((c) => c.score)
        .filter((s): s is number => s !== null);
      const melhorScore = scores.length ? Math.max(...scores) : null;
      const ultimaGeracao = vaga.curriculos.length
        ? vaga.curriculos
            .map((c) => c.geradoEm)
            .reduce((a, b) => (b > a ? b : a))
        : null;
      return {
        vagaId: vaga.id,
        titulo: vaga.titulo,
        empresa: vaga.empresa,
        melhorScore,
        versoes: vaga.curriculos.length,
        ultimaGeracao,
      };
    });

    linhas.sort((a, b) => (b.melhorScore ?? -1) - (a.melhorScore ?? -1));
    return linhas;
  }
}
