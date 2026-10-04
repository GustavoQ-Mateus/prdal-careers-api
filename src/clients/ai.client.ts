import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { CotaTokensEsgotada, CotaTokensService } from '../cota/cota-tokens.service';
import type { BlocoNativo, MensagemNativa } from '../copiloto/historico';

const DEFAULT_GENERATE_TIMEOUT_MS = 300000;
const DEFAULT_LLM_TIMEOUT_MS = 60000;
const MARGEM_PRAZO_MS = 1000;
export const HEADER_PRAZO = 'X-Prdal-Prazo-Ms';
export const HEADER_OPERACAO = 'X-Prdal-Operacao';
export const DEGRADACAO_KEYWORDS_INDISPONIVEIS =
  'A extração de keywords da vaga está indisponível no momento. Tente novamente em instantes.';

function envMs(nome: string, fallback: number): number {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : fallback;
}

export interface UsoLlm {
  entrada: number;
  saida: number;
  cacheLida: number;
  cacheEscrita: number;
  chamadas: number;
}

export interface ComUso {
  uso?: UsoLlm | null;
  modelo?: string | null;
}

export interface OpcoesIa {
  operacao?: string;
  usuarioId?: string | null;
}

export interface Keyword {
  termo: string;
  peso: number;
}

export type KeywordStatus = 'VALIDAS' | 'PENDENTE';

export interface KeywordExtraction extends ComUso {
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
  scoreVersao?: number;
  breakdown: ScoreBreakdown;
}

export interface AtsAnalysis {
  score: number;
  scoreVersao?: number;
  keywordsEncontradas: string[];
  keywordsCriticasAusentes: string[];
  pontosEliminatorios: string[];
  veredicto: string;
  breakdown: ScoreBreakdown;
}

export interface FonteContexto {
  id: string;
  tipo: string;
  factual: boolean;
  titulo: string;
  texto: string;
  origem?: string;
}

export interface GeneratePipelineResult extends ComUso {
  markdown: string;
  estrutura?: unknown;
  analiseInicial: AtsAnalysis;
  analiseFinal: AtsAnalysis;
  degradacao: string | null;
  promptVersion?: string | null;
}

@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);
  private readonly baseUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
  private readonly generateTimeoutMs = envMs(
    'AI_GENERATE_TIMEOUT_MS',
    DEFAULT_GENERATE_TIMEOUT_MS,
  );
  private readonly llmTimeoutMs = envMs('AI_LLM_TIMEOUT_MS', DEFAULT_LLM_TIMEOUT_MS);

  constructor(
    private readonly http: HttpService,
    @Optional() private readonly cota?: CotaTokensService,
  ) {}

  private async registrarUso(usuarioId: string, uso: UsoLlm | null | undefined) {
    try {
      await this.cota?.registrar(usuarioId, uso);
    } catch (err) {
      this.logger.warn(`uso de tokens nao registrado usuario=${usuarioId} causa=${(err as Error).message}`);
    }
  }

  private async comCota<T extends ComUso>(opcoes: OpcoesIa, chamada: () => Promise<T>): Promise<T> {
    const usuarioId = opcoes.usuarioId;
    if (!usuarioId || !this.cota) return chamada();
    await this.cota.verificar(usuarioId);
    try {
      const dados = await chamada();
      await this.registrarUso(usuarioId, dados.uso);
      return dados;
    } catch (err) {
      const uso = (err as AxiosError<ComUso>).response?.data?.uso;
      if (uso) await this.registrarUso(usuarioId, uso);
      throw err;
    }
  }

  private comPrazo(timeoutMs: number, opcoes: OpcoesIa = {}) {
    return {
      timeout: timeoutMs,
      headers: {
        [HEADER_PRAZO]: String(Math.max(1, timeoutMs - MARGEM_PRAZO_MS)),
        ...(opcoes.operacao ? { [HEADER_OPERACAO]: opcoes.operacao } : {}),
      },
    };
  }

  async keywords(descricao: string, opcoes: OpcoesIa = {}): Promise<KeywordExtraction> {
    try {
      const data = await this.comCota(opcoes, async () => {
        const resposta = await firstValueFrom(
          this.http.post<KeywordExtraction>(
            `${this.baseUrl}/keywords`,
            { descricao },
            this.comPrazo(this.llmTimeoutMs, opcoes),
          ),
        );
        return resposta.data;
      });
      return {
        keywords: data.keywords ?? [],
        status: data.status === 'VALIDAS' && data.keywords?.length ? 'VALIDAS' : 'PENDENTE',
        degradacao: data.degradacao ?? null,
        uso: data.uso ?? null,
        modelo: data.modelo ?? null,
      };
    } catch (err) {
      if (err instanceof CotaTokensEsgotada) throw err;
      this.logger.warn(
        `degradacao codigo=keywords_ai_service_indisponivel causa=${(err as Error).message}`,
      );
      return {
        keywords: [],
        status: 'PENDENTE',
        degradacao: DEGRADACAO_KEYWORDS_INDISPONIVEIS,
      };
    }
  }

  async generateCv(payload: {
    perfilMestre: unknown;
    vaga: unknown;
    keywords: Keyword[];
    contexto: FonteContexto[];
  }): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.post<{ markdown: string }>(
        `${this.baseUrl}/generate-cv`,
        payload,
        this.comPrazo(this.generateTimeoutMs),
      ),
    );
    return data.markdown;
  }

  async generateCvPipeline(
    payload: {
      perfilMestre: unknown;
      vaga: unknown;
      keywords: Keyword[];
      contexto: FonteContexto[];
    },
    opcoes: OpcoesIa = {},
  ): Promise<GeneratePipelineResult> {
    return this.comCota(opcoes, async () => {
      const { data } = await firstValueFrom(
        this.http.post<GeneratePipelineResult>(
          `${this.baseUrl}/generate-cv-pipeline`,
          payload,
          this.comPrazo(this.generateTimeoutMs, opcoes),
        ),
      );
      return data;
    });
  }

  async reduzirCurriculo(
    payload: {
      perfilMestre: unknown;
      vaga: unknown;
      keywords: Keyword[];
      estrutura: unknown;
      nivel: number;
    },
    opcoes: OpcoesIa = {},
  ): Promise<GeneratePipelineResult> {
    const { data } = await firstValueFrom(
      this.http.post<GeneratePipelineResult>(
        `${this.baseUrl}/reduzir-curriculo`,
        payload,
        this.comPrazo(this.llmTimeoutMs, opcoes),
      ),
    );
    return data;
  }

  async analisarAts(payload: {
    perfilMestre: unknown;
    vaga: unknown;
    keywords: Keyword[];
    contexto: FonteContexto[];
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
      tipo: string;
      factual: boolean;
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
    consulta: string | string[],
    k = 5,
  ): Promise<{ chunks: FonteContexto[] }> {
    const corpo = Array.isArray(consulta)
      ? { usuarioId, consultas: consulta, k }
      : { usuarioId, query: consulta, k };
    const { data } = await firstValueFrom(
      this.http.post<{ chunks: FonteContexto[] }>(`${this.baseUrl}/context/query`, corpo),
    );
    return data;
  }

  async copilotoTurn(
    payload: {
      modo: string;
      oportunidadeId: string | null;
      mensagens: MensagemNativa[];
      tools: ToolNativa[];
    },
    opcoes: OpcoesIa = {},
  ): Promise<CopilotoTurno> {
    return this.comCota(opcoes, async () => {
      const { data } = await firstValueFrom(
        this.http.post<CopilotoTurno>(
          `${this.baseUrl}/copiloto/turn`,
          payload,
          this.comPrazo(this.llmTimeoutMs, opcoes),
        ),
      );
      return data;
    });
  }

  async redigirMensagem(
    payload: {
      vaga: unknown;
      perfil: unknown;
      contexto: string;
    },
    opcoes: OpcoesIa = {},
  ): Promise<RedacaoMensagem> {
    return this.comCota(opcoes, async () => {
      const { data } = await firstValueFrom(
        this.http.post<RedacaoMensagem>(
          `${this.baseUrl}/copiloto/redigir-mensagem`,
          payload,
          this.comPrazo(this.llmTimeoutMs, opcoes),
        ),
      );
      return data;
    });
  }

  async redigirFormulario(
    payload: {
      vaga: unknown;
      perfil: unknown;
      campos: string[];
    },
    opcoes: OpcoesIa = {},
  ): Promise<RedacaoFormulario> {
    return this.comCota(opcoes, async () => {
      const { data } = await firstValueFrom(
        this.http.post<RedacaoFormulario>(
          `${this.baseUrl}/copiloto/redigir-formulario`,
          payload,
          this.comPrazo(this.llmTimeoutMs, opcoes),
        ),
      );
      return data;
    });
  }
}

export interface RedacaoMensagem extends ComUso {
  titulo: string;
  texto: string;
  destino: string;
}

export interface RedacaoFormulario extends ComUso {
  titulo: string;
  respostas: { campo: string; texto: string }[];
  texto: string;
}

export interface ToolNativa {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict?: boolean;
}

export interface CopilotoTurno extends ComUso {
  conteudo: BlocoNativo[];
  parada: string;
}
