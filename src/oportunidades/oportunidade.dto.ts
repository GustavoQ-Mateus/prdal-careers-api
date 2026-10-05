import { PrioridadeOportunidade } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';
import { DestinoTransicao } from '../dominio/transicoes';

export class ItemImportacaoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.titulo)
  titulo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.empresa)
  empresa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.url)
  fonte?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.descricaoVaga)
  descricao!: string;
}

export class CriarOportunidadeDto {
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
  @IsString()
  @MaxLength(LIMITE.url)
  fonte?: string;
}

export class AtualizarOportunidadeDto {
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
  @IsString()
  @MaxLength(LIMITE.url)
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
  @ArrayMaxSize(LIMITE.itens)
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
  @MaxLength(LIMITE.itemLista)
  motivo?: string;
}

export class NotaTimelineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.nota)
  descricao!: string;
}
