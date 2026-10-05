import { Injectable, Logger } from '@nestjs/common';
import { AiClient, FonteContexto } from '../clients/ai.client';
import { DocumentoRagRegistro } from '../repositorios/tipos';
import { VetoresRepositorio } from '../repositorios/vetores.repositorio';

export const TETO_CONSULTAS = 12;
export const TETO_CHUNKS = 20;
export const POR_CONSULTA = 5;
export const DEGRADACAO_REINDEXACAO =
  'Parte do histórico de notas e candidaturas ainda não foi reindexada com o modelo atual e ficou fora desta geração.';

export interface ContextoRecuperado {
  chunks: FonteContexto[];
  degradacao: string | null;
}

export function consultasUnicas(consultas: string[]): string[] {
  const vistas = new Set<string>();
  const unicas: string[] = [];
  for (const consulta of consultas) {
    const limpa = consulta.trim();
    const chave = limpa.toLowerCase();
    if (limpa && !vistas.has(chave)) {
      vistas.add(chave);
      unicas.push(limpa);
    }
  }
  return unicas.slice(0, TETO_CONSULTAS);
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly ai: AiClient,
    private readonly vetores: VetoresRepositorio,
  ) {}

  async modeloAtual(): Promise<string> {
    const { modelo, dimensao } = await this.ai.embeddingConsultas([]);
    await this.vetores.exigirDimensao(dimensao);
    return modelo;
  }

  async indexar(documento: DocumentoRagRegistro): Promise<number> {
    const resposta = await this.ai.embeddingDocumentos([
      { id: documento.id, origemId: documento.origemId, tipo: documento.tipo, texto: documento.texto },
    ]);
    await this.vetores.exigirDimensao(resposta.dimensao);
    const chunks = resposta.chunks.filter((chunk) => chunk.documentoId === documento.id);
    await this.vetores.substituir(documento.id, documento.usuarioId, resposta.modelo, chunks);
    return chunks.length;
  }

  async recuperar(usuarioId: string, consultas: string[], porConsulta = POR_CONSULTA): Promise<ContextoRecuperado> {
    const unicas = consultasUnicas(consultas);
    if (!unicas.length) return { chunks: [], degradacao: null };
    const { modelo, dimensao, limiar, vetores } = await this.ai.embeddingConsultas(unicas);
    await this.vetores.exigirDimensao(dimensao);
    const [encontrados, deOutroModelo] = await Promise.all([
      this.vetores.buscar(usuarioId, modelo, vetores, porConsulta),
      this.vetores.contarDeOutroModelo(usuarioId, modelo),
    ]);
    const melhores = new Map<string, FonteContexto & { similaridade: number }>();
    for (const chunk of encontrados) {
      if (chunk.similaridade < limiar) continue;
      const atual = melhores.get(chunk.fonteId);
      if (atual && atual.similaridade >= chunk.similaridade) continue;
      melhores.set(chunk.fonteId, {
        id: chunk.fonteId,
        tipo: chunk.tipo,
        factual: chunk.factual,
        titulo: chunk.titulo,
        texto: chunk.texto,
        origem: chunk.origem,
        similaridade: Math.round(chunk.similaridade * 10000) / 10000,
      });
    }
    const ordenados = [...melhores.values()].sort((a, b) => b.similaridade - a.similaridade);
    this.logger.log(
      `rag consultas=${unicas.length} candidatos=${encontrados.length} acima_do_limiar=${ordenados.length} limiar=${limiar} modelo=${modelo}`,
    );
    return {
      chunks: ordenados.slice(0, TETO_CHUNKS),
      degradacao: deOutroModelo > 0 ? DEGRADACAO_REINDEXACAO : null,
    };
  }
}
