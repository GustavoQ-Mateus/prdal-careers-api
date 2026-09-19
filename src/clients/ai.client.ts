import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

const DEFAULT_GENERATE_TIMEOUT_MS = 300000;

function envMs(nome: string, fallback: number): number {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : fallback;
}

export interface Keyword {
  termo: string;
  peso: number;
}

export type KeywordStatus = 'VALIDAS' | 'PENDENTE';

export interface KeywordExtraction {
  keywords: Keyword[];
  status: KeywordStatus;
  degradacao: string | null;
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

export interface AtsAnalysis {
  score: number;
  keywordsEncontradas: string[];
  keywordsCriticasAusentes: string[];
  pontosEliminatorios: string[];
  veredicto: string;
  breakdown: ScoreBreakdown;
}

export interface GeneratePipelineResult {
  markdown: string;
  analiseInicial: AtsAnalysis;
  analiseFinal: AtsAnalysis;
  degradacao: string | null;
}

@Injectable()
export class AiClient {
  private readonly baseUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
  private readonly generateTimeoutMs = envMs(
    'AI_GENERATE_TIMEOUT_MS',
    DEFAULT_GENERATE_TIMEOUT_MS,
  );

  constructor(private readonly http: HttpService) {}

  async keywords(descricao: string): Promise<KeywordExtraction> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<KeywordExtraction>(`${this.baseUrl}/keywords`, {
          descricao,
        }),
      );
      return {
        keywords: data.keywords ?? [],
        status: data.status === 'VALIDAS' && data.keywords?.length ? 'VALIDAS' : 'PENDENTE',
        degradacao: data.degradacao ?? null,
      };
    } catch (err) {
      return {
        keywords: [],
        status: 'PENDENTE',
        degradacao: `Extracao de keywords indisponivel: ${(err as Error).message}`,
      };
    }
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

  async generateCvPipeline(payload: {
    perfilMestre: unknown;
    vaga: unknown;
    keywords: Keyword[];
    contexto: string[];
  }): Promise<GeneratePipelineResult> {
    const { data } = await firstValueFrom(
      this.http.post<GeneratePipelineResult>(
        `${this.baseUrl}/generate-cv-pipeline`,
        payload,
        { timeout: this.generateTimeoutMs },
      ),
    );
    return data;
  }

  async reduzirCurriculo(payload: {
    perfilMestre: unknown;
    vaga: unknown;
    keywords: Keyword[];
    contexto: string[];
    markdownAtual: string;
  }): Promise<GeneratePipelineResult> {
    const { data } = await firstValueFrom(
      this.http.post<GeneratePipelineResult>(
        `${this.baseUrl}/reduzir-curriculo`,
        payload,
        { timeout: this.generateTimeoutMs },
      ),
    );
    return data;
  }

  async analisarAts(payload: {
    perfilMestre: unknown;
    vaga: unknown;
    keywords: Keyword[];
    contexto: string[];
  }): Promise<AtsAnalysis> {
    const { data } = await firstValueFrom(
      this.http.post<AtsAnalysis>(`${this.baseUrl}/analisar-ats`, payload),
    );
    return data;
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

  async taxonomy(): Promise<{ categorias: string[]; niveis: string[] }> {
    const { data } = await firstValueFrom(
      this.http.get<{ categorias: string[]; niveis: string[] }>(
        `${this.baseUrl}/classify/taxonomy`,
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

  async copilotoTurn(payload: {
    modo: string;
    oportunidadeId: string | null;
    mensagens: { papel: string; conteudo: string; tool?: string | null }[];
    tools: {
      nome: string;
      efeito: string;
      descricao: string;
      parametros: Record<string, unknown>;
    }[];
  }): Promise<CopilotoTurno> {
    const { data } = await firstValueFrom(
      this.http.post<CopilotoTurno>(`${this.baseUrl}/copiloto/turn`, payload),
    );
    return data;
  }

  async redigirMensagem(payload: {
    vaga: unknown;
    perfil: unknown;
    contexto: string;
  }): Promise<{ titulo: string; texto: string; destino: string }> {
    const { data } = await firstValueFrom(
      this.http.post<{ titulo: string; texto: string; destino: string }>(
        `${this.baseUrl}/copiloto/redigir-mensagem`,
        payload,
      ),
    );
    return data;
  }

  async redigirFormulario(payload: {
    vaga: unknown;
    perfil: unknown;
    campos: string[];
  }): Promise<{
    titulo: string;
    respostas: { campo: string; texto: string }[];
    texto: string;
  }> {
    const { data } = await firstValueFrom(
      this.http.post<{
        titulo: string;
        respostas: { campo: string; texto: string }[];
        texto: string;
      }>(`${this.baseUrl}/copiloto/redigir-formulario`, payload),
    );
    return data;
  }
}

export interface CopilotoTurno {
  tipo: 'texto' | 'tool_call';
  texto: string | null;
  tool: string | null;
  args: Record<string, unknown>;
}
