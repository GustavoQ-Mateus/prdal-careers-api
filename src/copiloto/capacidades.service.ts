import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { AiClient } from '../clients/ai.client';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PerfilService } from '../perfil/perfil.service';
import { perfilParaIa } from '../perfil/perfil.normalizacao';

export const MENSAGEM_IA_INDISPONIVEL =
  'O assistente está indisponível no momento. Tente novamente em instantes.';

function iaIndisponivel(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  if (!err.response) return true;
  return err.response.status === 503 || err.response.status === 502 || err.response.status === 504;
}

@Injectable()
export class CapacidadesService {
  private readonly logger = new Logger(CapacidadesService.name);

  constructor(
    private readonly ai: AiClient,
    private readonly oportunidades: OportunidadesService,
    private readonly perfil: PerfilService,
  ) {}

  async mensagemRecrutador(
    usuarioId: string,
    oportunidadeId: string,
    contexto?: string,
  ) {
    const vaga = await this.oportunidades.buscar(usuarioId, oportunidadeId);
    const perfil = await this.perfil.buscar(usuarioId);
    const redacao = await this.chamarIa('redigir-mensagem', () =>
      this.ai.redigirMensagem(
        {
          vaga,
          perfil: perfil ? perfilParaIa(perfil) : {},
          contexto: contexto ?? '',
        },
        { usuarioId },
      ),
    );
    return { tipo: 'mensagem_recrutador' as const, titulo: redacao.titulo, texto: redacao.texto, destino: redacao.destino };
  }

  async respostasFormulario(
    usuarioId: string,
    oportunidadeId: string,
    campos: string[],
  ) {
    const vaga = await this.oportunidades.buscar(usuarioId, oportunidadeId);
    const perfil = await this.perfil.buscar(usuarioId);
    const redacao = await this.chamarIa('redigir-formulario', () =>
      this.ai.redigirFormulario(
        {
          vaga,
          perfil: perfil ? perfilParaIa(perfil) : {},
          campos,
        },
        { usuarioId },
      ),
    );
    return { tipo: 'resposta_formulario' as const, titulo: redacao.titulo, respostas: redacao.respostas, texto: redacao.texto };
  }

  private async chamarIa<T>(operacao: string, chamada: () => Promise<T>): Promise<T> {
    try {
      return await chamada();
    } catch (err) {
      if (!iaIndisponivel(err)) throw err;
      const axios = err as AxiosError;
      this.logger.warn(
        `ai-service indisponivel operacao=${operacao} status=${axios.response?.status ?? 'sem-resposta'} codigo=${axios.code ?? 'n/a'}`,
      );
      throw new ServiceUnavailableException(MENSAGEM_IA_INDISPONIVEL);
    }
  }
}
