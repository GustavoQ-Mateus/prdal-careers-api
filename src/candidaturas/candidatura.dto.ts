import { StatusCandidatura } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CriarCandidaturaDto {
  @IsString()
  vagaId!: string;

  @IsOptional()
  @IsString()
  curriculoId?: string;
}

export class AtualizarCandidaturaDto {
  @IsOptional()
  @IsEnum(StatusCandidatura)
  status?: StatusCandidatura;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  curriculoId?: string;
}
