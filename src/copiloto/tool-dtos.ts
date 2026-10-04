import 'reflect-metadata';
import { PrioridadeOportunidade } from '@prisma/client';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CriarAcaoDto } from '../acoes/acao.dto';
import { AtualizarCandidaturaDto, CriarCandidaturaDto } from '../candidaturas/candidatura.dto';
import { EditarCurriculoDto } from '../curriculos/curriculo.dto';
import { LIMITE } from '../dominio/limites';
import { HojeQueryDto } from '../hoje/hoje.dto';
import {
  CriarOportunidadeDto,
  NotaTimelineDto,
  TransicaoDto,
} from '../oportunidades/oportunidade.dto';

export { CriarCandidaturaDto, CriarOportunidadeDto, HojeQueryDto };
export { MensagemRecrutadorDto, RespostasFormularioDto } from './copiloto.dto';

export const VISOES_OPORTUNIDADE = ['ativas', 'encerradas', 'entrada'] as const;
export const ORDENACOES_OPORTUNIDADE = ['prioridade', 'score', 'keywords', 'etapa', 'prazo'] as const;

export class SemArgumentosDto {}

export class OportunidadeAlvoDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId?: string;
}

export class ListarOportunidadesDto {
  @IsOptional()
  @IsIn(VISOES_OPORTUNIDADE)
  visao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.consulta)
  busca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  nivel?: string;

  @IsOptional()
  @IsIn(Object.values(PrioridadeOportunidade))
  prioridade?: PrioridadeOportunidade;

  @IsOptional()
  @IsIn(ORDENACOES_OPORTUNIDADE)
  ordenarPor?: string;
}

export class LerTimelineDto extends OportunidadeAlvoDto {
  @IsOptional()
  @IsDateString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}

export class ListarCurriculosDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  vagaId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoreMinimo?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  vinculado?: string;
}

export class CurriculoAlvoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  curriculoId!: string;
}

export class GeracaoAlvoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  jobId!: string;
}

export class EntradaAlvoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  entradaId!: string;
}

export class BancoVagaAlvoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  bancoVagaId!: string;
}

export class AcaoAlvoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  acaoId!: string;
}

export class EditarCurriculoToolDto extends EditarCurriculoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  curriculoId!: string;
}

export class DefinirProximoPassoDto extends CriarAcaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId?: string;
}

export class MoverEstagioDto extends TransicaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId?: string;
}

export class AtualizarCandidaturaToolDto extends AtualizarCandidaturaDto {
  @IsString()
  @MaxLength(LIMITE.id)
  candidaturaId!: string;
}

export class RegistrarNotaDto extends NotaTimelineDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId?: string;
}
