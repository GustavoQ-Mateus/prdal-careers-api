import { PrioridadeOportunidade } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ItemImportacaoDto } from '../banco-vagas/banco-vaga.dto';
import { DestinoTransicao } from '../dominio/transicoes';

export class CriarOportunidadeDto {
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
  @IsString()
  fonte?: string;
}

export class AtualizarOportunidadeDto {
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
  @IsString()
  fonte?: string;

  @IsOptional()
  @IsEnum(PrioridadeOportunidade)
  prioridade?: PrioridadeOportunidade;

  @IsOptional()
  @IsBoolean()
  arquivar?: boolean;
}

export class ImportarOportunidadesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemImportacaoDto)
  itens!: ItemImportacaoDto[];
}

export class TransicaoDto {
  @IsIn([
    'PREPARACAO',
    'INSCRITA',
    'EM_PROCESSO',
    'ENTREVISTA',
    'OFERTA',
    'REJEITADA',
    'DESISTIU',
    'ARQUIVADA',
    'REABRIR',
  ])
  destino!: DestinoTransicao;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class NotaTimelineDto {
  @IsString()
  @MinLength(1)
  descricao!: string;
}
