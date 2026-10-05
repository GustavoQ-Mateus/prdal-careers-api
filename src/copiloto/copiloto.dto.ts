import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
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
