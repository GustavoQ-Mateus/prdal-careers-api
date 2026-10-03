import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class ConfirmacaoDto {
  @IsString()
  @MaxLength(LIMITE.id)
  callId!: string;

  @IsIn(['confirmar', 'recusar'])
  decisao!: 'confirmar' | 'recusar';

  @IsOptional()
  @IsObject()
  ajustes?: Record<string, unknown>;
}

export class ChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  conversaId?: string;

  @IsOptional()
  @IsIn(['assistido', 'autopiloto'])
  modo?: 'assistido' | 'autopiloto';

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.mensagemChat)
  mensagem?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmacaoDto)
  confirmacao?: ConfirmacaoDto;
}

export class KeywordsPreviaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.descricaoVaga)
  descricao!: string;
}

export class RagConsultaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.consulta)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  k?: number;
}

export class KeywordDto {
  @IsString()
  @MaxLength(LIMITE.termo)
  termo!: string;

  @Type(() => Number)
  peso!: number;
}

export class ScoreAvulsoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.markdownCurriculo)
  markdown!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITE.keywords)
  @ValidateNested({ each: true })
  @Type(() => KeywordDto)
  keywords?: KeywordDto[];
}

export class MensagemRecrutadorDto {
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.mensagemChat)
  contexto?: string;
}

export class RespostasFormularioDto {
  @IsString()
  @MaxLength(LIMITE.id)
  oportunidadeId!: string;

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @IsString({ each: true })
  @MaxLength(LIMITE.itemLista, { each: true })
  campos!: string[];
}
