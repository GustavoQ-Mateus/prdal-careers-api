import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class EditarCurriculoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.markdownCurriculo)
  markdown!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  rotulo?: string;
}
