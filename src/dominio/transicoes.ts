import { StatusCandidatura } from '@prisma/client';

export type DestinoTransicao =
  | 'PREPARACAO'
  | 'INSCRITA'
  | 'EM_PROCESSO'
  | 'ENTREVISTA'
  | 'OFERTA'
  | 'REJEITADA'
  | 'DESISTIU'
  | 'ARQUIVADA'
  | 'REABRIR';

export type OrigemTransicao =
  | 'PREPARACAO'
  | 'INSCRITA'
  | 'EM_PROCESSO'
  | 'ENTREVISTA'
  | 'OFERTA'
  | 'REJEITADA'
  | 'DESISTIU'
  | 'ARQUIVADA';

const PERMITIDOS: Record<OrigemTransicao, DestinoTransicao[]> = {
  PREPARACAO: ['INSCRITA', 'ARQUIVADA'],
  INSCRITA: [
    'PREPARACAO',
    'EM_PROCESSO',
    'ENTREVISTA',
    'OFERTA',
    'REJEITADA',
    'DESISTIU',
    'ARQUIVADA',
  ],
  EM_PROCESSO: [
    'INSCRITA',
    'ENTREVISTA',
    'OFERTA',
    'REJEITADA',
    'DESISTIU',
    'ARQUIVADA',
  ],
  ENTREVISTA: ['EM_PROCESSO', 'OFERTA', 'REJEITADA', 'DESISTIU', 'ARQUIVADA'],
  OFERTA: ['ENTREVISTA', 'REJEITADA', 'DESISTIU', 'ARQUIVADA'],
  REJEITADA: ['PREPARACAO'],
  DESISTIU: ['PREPARACAO'],
  ARQUIVADA: ['REABRIR'],
};

export function origemTransicao(
  arquivadaEm: Date | null,
  status: StatusCandidatura | null,
): OrigemTransicao {
  if (arquivadaEm) return 'ARQUIVADA';
  if (!status || status === 'RASCUNHO') return 'PREPARACAO';
  return status;
}

export function transicaoPermitida(
  origem: OrigemTransicao,
  destino: DestinoTransicao,
): boolean {
  return PERMITIDOS[origem]?.includes(destino) ?? false;
}

export const STATUS_ATIVOS: StatusCandidatura[] = [
  'EM_PROCESSO',
  'ENTREVISTA',
  'OFERTA',
];
