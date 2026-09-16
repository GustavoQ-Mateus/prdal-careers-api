import { IsOptional, IsString } from 'class-validator';

export class PatchPreferenciasDto {
  @IsOptional()
  @IsString()
  fusoHorario?: string;
}
