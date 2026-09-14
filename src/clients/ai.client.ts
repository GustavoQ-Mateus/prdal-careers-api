import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

export interface Keyword {
  termo: string;
  peso: number;
}

export interface ScoreBreakdown {
  keywordMatch: number;
  densidade: number;
  secoes: number;
  faltando: string[];
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
}

@Injectable()
export class AiClient {
  private readonly baseUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

  constructor(private readonly http: HttpService) {}

  async keywords(descricao: string): Promise<Keyword[]> {
    const { data } = await firstValueFrom(
      this.http.post<{ keywords: Keyword[] }>(`${this.baseUrl}/keywords`, {
        descricao,
      }),
    );
    return data.keywords;
  }

  async generateCv(payload: {
    perfilMestre: unknown;
    vaga: unknown;
    keywords: Keyword[];
    contexto: string[];
  }): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.post<{ markdown: string }>(
        `${this.baseUrl}/generate-cv`,
        payload,
      ),
    );
    return data.markdown;
  }

  async score(markdown: string, vaga: {
    keywords: Keyword[];
  }): Promise<ScoreResult> {
    const { data } = await firstValueFrom(
      this.http.post<ScoreResult>(`${this.baseUrl}/score`, { markdown, vaga }),
    );
    return data;
  }

  async classify(
    titulo: string,
    descricao: string,
  ): Promise<{ categoria: string; nivel: string }> {
    const { data } = await firstValueFrom(
      this.http.post<{ categoria: string; nivel: string }>(
        `${this.baseUrl}/classify`,
        { titulo, descricao },
      ),
    );
    return data;
  }

  async contextIngest(
    documentos: {
      usuarioId: string;
      origem: string;
      origemId: string;
      titulo: string;
      texto: string;
    }[],
  ): Promise<{ indexados: number }> {
    const { data } = await firstValueFrom(
      this.http.post<{ indexados: number }>(`${this.baseUrl}/context/ingest`, {
        documentos,
      }),
    );
    return data;
  }

  async contextQuery(
    usuarioId: string,
    query: string,
    k = 5,
  ): Promise<{ chunks: { texto: string; origem: string; titulo: string }[] }> {
    const { data } = await firstValueFrom(
      this.http.post<{ chunks: { texto: string; origem: string; titulo: string }[] }>(
        `${this.baseUrl}/context/query`,
        { usuarioId, query, k },
      ),
    );
    return data;
  }
}
