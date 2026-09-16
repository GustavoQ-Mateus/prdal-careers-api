import { TipoAcaoOportunidade } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CriarAcaoDto {
  @IsString()
  @MinLength(1)
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
  candidaturaId?: string;
}

export class AtualizarAcaoDto {
  @IsOptional()
  @IsString()
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
  cursor?: string;
}
