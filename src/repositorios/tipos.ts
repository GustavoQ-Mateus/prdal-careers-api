import type { BlocoNativo } from '../copiloto/historico';
import type { DadosNarracao } from '../pipeline-ats/narracao';

export type OrigemDocumentoRag = 'perfil' | 'candidatura' | 'nota';

export type TipoDocumentoRag =
  | 'experiencia'
  | 'resumo'
  | 'skills'
  | 'formacao'
  | 'certificacao'
  | 'idiomas'
  | 'nota'
  | 'candidatura';

const TIPOS_PERFIL: TipoDocumentoRag[] = ['experiencia', 'resumo', 'skills', 'formacao', 'certificacao', 'idiomas'];

export function tipoPadraoRag(origem: OrigemDocumentoRag, origemId: string): TipoDocumentoRag {
  if (origem !== 'perfil') return origem;
  return TIPOS_PERFIL.find((tipo) => origemId === tipo || origemId.startsWith(`${tipo}-`)) ?? 'experiencia';
}

export interface DocumentoRagRegistro {
  id: string;
  usuarioId: string;
  origem: OrigemDocumentoRag;
  origemId: string;
  tipo: TipoDocumentoRag;
  factual: boolean;
  titulo: string;
  texto: string;
  notaId: string | null;
  candidaturaId: string | null;
  criadoEm: Date;
}

export interface NotaObsidianRegistro {
  id: string;
  usuarioId: string;
  titulo: string;
  corpo: string;
  historico: boolean;
  criadoEm: Date;
}

export interface MensagemCopiloto {
  papel: 'user' | 'assistant' | 'tool' | 'evento';
  conteudo: string;
  tool?: string | null;
  blocos?: BlocoNativo[];
  dados?: {
    callId?: string;
    efeito?: 'leitura' | 'escrita' | 'entrega_externa';
    args?: Record<string, unknown>;
    ok?: boolean;
    resultado?: unknown;
    erro?: string;
    entrega?: { tipo: string; titulo: string; texto: string; destino?: string };
    evento?: 'erro' | 'cancelado';
    escopo?: string;
    origem?: 'geracao_assincrona';
    jobId?: string;
    etapa?: 1 | 3;
    narracao?: DadosNarracao;
  };
}

export interface PendenciaCopiloto {
  callId: string;
  tool: string;
  efeito: 'escrita';
  args: Record<string, unknown>;
  resumo?: string;
  executando?: boolean;
}

export interface ConfirmacaoCopiloto {
  callId: string;
  tool: string;
  decisao: 'confirmar' | 'recusar';
  resultado?: unknown;
  erro?: string;
  concluidaEm: Date;
}

export interface ResumoConversa {
  texto: string;
  ate: number;
}

export type ModoCopiloto = 'assistido' | 'autopiloto';

export interface ConversaCopiloto {
  id: string;
  usuarioId: string;
  modo: ModoCopiloto;
  oportunidadeId: string | null;
  inicioJanela: number;
  mensagens: MensagemCopiloto[];
  pendencia: PendenciaCopiloto | null;
  resumo?: ResumoConversa | null;
  criadoEm: Date;
  atualizadoEm: Date;
}
