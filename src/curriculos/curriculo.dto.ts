import { IsOptional, IsString, MinLength } from 'class-validator';

export class EditarCurriculoDto {
  @IsString()
  @MinLength(1)
  markdown!: string;

  @IsOptional()
  @IsString()
  rotulo?: string;
}
