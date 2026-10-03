import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class PipelineFiltrosDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  busca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  apresentacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  statusCandidatura?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  nivel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  empresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  prioridade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  comCurriculo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreMinimo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  prazo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  atividadeDesde?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  ordenarPor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.termo)
  ordenarDirecao?: string;
}

export class PosicaoCanvasDto {
  @IsString()
  @MaxLength(LIMITE.id)
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
  @ArrayMaxSize(LIMITE.posicoesCanvas)
  @ValidateNested({ each: true })
  @Type(() => PosicaoCanvasDto)
  posicoes!: PosicaoCanvasDto[];
}
