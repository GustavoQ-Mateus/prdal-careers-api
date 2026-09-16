import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PipelineFiltrosDto {
  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsString()
  apresentacao?: string;

  @IsOptional()
  @IsString()
  statusCandidatura?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  prioridade?: string;

  @IsOptional()
  @IsString()
  comCurriculo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreMinimo?: number;

  @IsOptional()
  @IsString()
  prazo?: string;

  @IsOptional()
  @IsString()
  atividadeDesde?: string;

  @IsOptional()
  @IsString()
  ordenarPor?: string;
}

export class PosicaoCanvasDto {
  @IsString()
  vagaId!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class ViewportCanvasDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  zoom!: number;
}

export class SalvarCanvasDto {
  @IsNumber()
  revisaoBase!: number;

  @ValidateNested()
  @Type(() => ViewportCanvasDto)
  viewport!: ViewportCanvasDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosicaoCanvasDto)
  posicoes!: PosicaoCanvasDto[];
}
