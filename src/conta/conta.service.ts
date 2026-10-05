import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PROVEDOR_PADRAO = 'Anthropic (modelo Claude), por meio da OpenRouter';
export const REGIAO_PADRAO = 'Estados Unidos';

@Injectable()
export class ContaService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true, consentimentoLlmEm: true, exclusaoAgendadaPara: true },
    });
    if (!usuario) throw new NotFoundException('conta nao encontrada');
    return {
      email: usuario.email,
      consentimento: {
        aceitoEm: usuario.consentimentoLlmEm?.toISOString() ?? null,
        provedor: process.env.LLM_PROVEDOR?.trim() || PROVEDOR_PADRAO,
        regiao: process.env.LLM_REGIAO?.trim() || REGIAO_PADRAO,
      },
      exclusaoAgendadaPara: usuario.exclusaoAgendadaPara?.toISOString() ?? null,
    };
  }
}
