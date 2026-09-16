import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConfirmacaoDto {
  @IsString()
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
  conversaId?: string;

  @IsOptional()
  @IsIn(['assistido', 'autopiloto'])
  modo?: 'assistido' | 'autopiloto';

  @IsOptional()
  @IsString()
  oportunidadeId?: string;

  @IsOptional()
  @IsString()
  mensagem?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmacaoDto)
  confirmacao?: ConfirmacaoDto;
}

export class KeywordsPreviaDto {
  @IsString()
  @MinLength(1)
  descricao!: string;
}

export class RagConsultaDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  k?: number;
}

export class KeywordDto {
  @IsString()
  termo!: string;

  @Type(() => Number)
  peso!: number;
}

export class ScoreAvulsoDto {
  @IsString()
  @MinLength(1)
  markdown!: string;

  @IsOptional()
  @IsString()
  oportunidadeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeywordDto)
  keywords?: KeywordDto[];
}

export class MensagemRecrutadorDto {
  @IsString()
  oportunidadeId!: string;

  @IsOptional()
  @IsString()
  contexto?: string;
}

export class RespostasFormularioDto {
  @IsString()
  oportunidadeId!: string;

  @IsArray()
  @IsString({ each: true })
  campos!: string[];
}
