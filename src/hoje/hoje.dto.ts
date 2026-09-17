import { IsIn, IsOptional, IsString } from 'class-validator';

export class HojeQueryDto {
  @IsOptional()
  @IsString()
  de?: string;

  @IsOptional()
  @IsString()
  ate?: string;

  @IsOptional()
  @IsIn(['7', '30', '90'])
  periodo?: string;
}

export class PatchPreferenciasDto {
  @IsOptional()
  @IsString()
  fusoHorario?: string;
}
