import { BadRequestException, Injectable } from '@nestjs/common';
import { AiClient, Keyword } from '../clients/ai.client';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PerfilService } from '../perfil/perfil.service';
import { perfilParaIa } from '../perfil/perfil.normalizacao';

@Injectable()
export class CapacidadesService {
  constructor(
    private readonly ai: AiClient,
    private readonly oportunidades: OportunidadesService,
    private readonly perfil: PerfilService,
  ) {}

  async keywordsPrevia(descricao: string) {
    const keywords = await this.ai.keywords(descricao);
    return { keywords };
  }

  async consultarRag(usuarioId: string, query: string, k = 5) {
    return this.ai.contextQuery(usuarioId, query, k);
  }

  async score(
    usuarioId: string,
    markdown: string,
    oportunidadeId?: string,
    keywords?: Keyword[],
  ) {
    const usadas = await this.resolverKeywords(
      usuarioId,
      oportunidadeId,
      keywords,
    );
    if (usadas.length === 0) {
      throw new BadRequestException(
        'informe keywords ou uma oportunidade com keywords',
      );
    }
    return this.ai.score(markdown, { keywords: usadas });
  }

  async mensagemRecrutador(
    usuarioId: string,
    oportunidadeId: string,
    contexto?: string,
  ) {
    const vaga = await this.oportunidades.buscar(usuarioId, oportunidadeId);
    const perfil = await this.perfil.buscar(usuarioId);
    const redacao = await this.ai.redigirMensagem({
      vaga,
      perfil: perfil ? perfilParaIa(perfil) : {},
      contexto: contexto ?? '',
    });
    return { tipo: 'mensagem_recrutador' as const, ...redacao };
  }

  async respostasFormulario(
    usuarioId: string,
    oportunidadeId: string,
    campos: string[],
  ) {
    const vaga = await this.oportunidades.buscar(usuarioId, oportunidadeId);
    const perfil = await this.perfil.buscar(usuarioId);
    const redacao = await this.ai.redigirFormulario({
      vaga,
      perfil: perfil ? perfilParaIa(perfil) : {},
      campos,
    });
    return { tipo: 'resposta_formulario' as const, ...redacao };
  }

  private async resolverKeywords(
    usuarioId: string,
    oportunidadeId?: string,
    keywords?: Keyword[],
  ): Promise<Keyword[]> {
    if (keywords && keywords.length > 0) return keywords;
    if (!oportunidadeId) return [];
    const vaga = await this.oportunidades.buscar(usuarioId, oportunidadeId);
    const brutas = (vaga as { keywords?: unknown }).keywords;
    return Array.isArray(brutas) ? (brutas as Keyword[]) : [];
  }
}
