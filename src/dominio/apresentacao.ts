import { StatusCandidatura } from '@prisma/client';

export type ApresentacaoOportunidade = 'ENTRADA' | 'ATIVA' | 'ENCERRADA';

export type EtapaPipeline =
  | 'PREPARACAO'
  | 'INSCRITA'
  | 'EM_PROCESSO'
  | 'ENTREVISTA'
  | 'OFERTA'
  | 'ENCERRADAS';

const ENCERRADOS: StatusCandidatura[] = ['REJEITADA', 'DESISTIU'];

export function apresentacaoRelacional(
  arquivadaEm: Date | null,
  status: StatusCandidatura | null,
): ApresentacaoOportunidade {
  if (arquivadaEm || (status && ENCERRADOS.includes(status))) return 'ENCERRADA';
  return 'ATIVA';
}

export function etapaPipeline(
  arquivadaEm: Date | null,
  status: StatusCandidatura | null,
): EtapaPipeline {
  if (arquivadaEm || (status && ENCERRADOS.includes(status))) return 'ENCERRADAS';
  if (!status || status === 'RASCUNHO') return 'PREPARACAO';
  return status as EtapaPipeline;
}
