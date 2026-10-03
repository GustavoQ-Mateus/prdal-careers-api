import { TipoAcaoOportunidade } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class CriarAcaoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.titulo)
  titulo!: string;

  @IsEnum(TipoAcaoOportunidade)
  tipo!: TipoAcaoOportunidade;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;

  @IsOptional()
  @IsDateString()
  venceEm?: string;

  @IsOptional()
  @IsDateString()
  lembrarEm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  candidaturaId?: string;
}

export class AtualizarAcaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  titulo?: string;

  @IsOptional()
  @IsEnum(TipoAcaoOportunidade)
  tipo?: TipoAcaoOportunidade;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;

  @IsOptional()
  @IsDateString()
  venceEm?: string | null;

  @IsOptional()
  @IsDateString()
  lembrarEm?: string | null;
}

export class QueryTimelineDto {
  @IsOptional()
  @Type(() => Number)
  limite?: number;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.textoCurto)
  cursor?: string;
}
