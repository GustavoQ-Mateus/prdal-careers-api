import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CriarVagaDto {
  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsString()
  @MinLength(1)
  empresa!: string;

  @IsString()
  @MinLength(1)
  descricao!: string;

  @IsOptional()
  @IsUrl()
  fonte?: string;
}

export class AtualizarVagaDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsUrl()
  fonte?: string;
}
