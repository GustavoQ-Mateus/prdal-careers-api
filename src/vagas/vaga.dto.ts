import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class CriarVagaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.titulo)
  titulo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.empresa)
  empresa!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.descricaoVaga)
  descricao!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(LIMITE.url)
  fonte?: string;
}

export class AtualizarVagaDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.empresa)
  empresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.descricaoVaga)
  descricao?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(LIMITE.url)
  fonte?: string;
}
