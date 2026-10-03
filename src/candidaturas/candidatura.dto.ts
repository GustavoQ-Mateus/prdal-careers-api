import { StatusCandidatura } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class CriarCandidaturaDto {
  @IsString()
  @MaxLength(LIMITE.id)
  vagaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  curriculoId?: string;
}

export class AtualizarCandidaturaDto {
  @IsOptional()
  @IsEnum(StatusCandidatura)
  status?: StatusCandidatura;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.nota)
  notas?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  curriculoId?: string;
}
