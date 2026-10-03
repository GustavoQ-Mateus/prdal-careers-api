import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class HojeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  de?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  ate?: string;

  @IsOptional()
  @IsIn(['7', '30', '90'])
  periodo?: string;
}

export class PatchPreferenciasDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  fusoHorario?: string;
}
