import { Injectable, NotFoundException } from '@nestjs/common';
import { Armazenamento } from '../arquivos/armazenamento';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';

export const PROVEDOR_PADRAO = 'Anthropic (modelo Claude), por meio da OpenRouter';
export const REGIAO_PADRAO = 'Estados Unidos';

@Injectable()
export class ContaService {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, private readonly armazenamento: Armazenamento) {}

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

  async consentir(usuarioId: string): Promise<void> {
    await this.prisma.usuario.updateMany({ where: { id: usuarioId, consentimentoLlmEm: null }, data: { consentimentoLlmEm: new Date() } });
  }

  async revogar(usuarioId: string): Promise<void> {
    await this.prisma.usuario.updateMany({ where: { id: usuarioId }, data: { consentimentoLlmEm: null } });
  }

  async exportar(usuarioId: string): Promise<{ jobId: string }> {
    const ativa = async () => this.prisma.job.findFirst({
      where: { usuarioId, tipo: 'exportar_dados', status: { in: ['PENDENTE', 'PROCESSANDO'] } },
      orderBy: { criadoEm: 'desc' },
    });
    let job = await ativa();
    if (!job) {
      try {
        job = await this.prisma.$transaction(async (tx) => this.jobs.criar(tx, {
          tipo: 'exportar_dados', usuarioId, referenciaId: usuarioId,
        }));
      } catch (erro) {
        if ((erro as { code?: string }).code !== 'P2002') throw erro;
        job = await ativa();
        if (!job) throw erro;
      }
    }
    if (job.status === 'PENDENTE') await this.jobs.enfileirar([job]);
    return { jobId: job.id };
  }

  async statusExportacao(usuarioId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, usuarioId, tipo: 'exportar_dados' } });
    if (!job) throw new NotFoundException('exportacao nao encontrada');
    if (job.status !== 'CONCLUIDO') return { status: job.status };
    const chave = (job.resultado as { chave?: string } | null)?.chave;
    if (!chave || chave !== `usuarios/${usuarioId}/exportacoes/${jobId}.zip`) throw new NotFoundException('arquivo de exportacao nao encontrado');
    const { url, expiraEm } = await this.armazenamento.urlDeDownload(chave, 'dados-da-conta.zip');
    return { status: job.status, url, expiraEm };
  }
}
