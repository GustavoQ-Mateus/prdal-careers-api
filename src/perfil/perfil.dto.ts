import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TIPOS_CONTATO, type TipoContato } from './perfil.normalizacao';

export class ContatoPerfilDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsIn(TIPOS_CONTATO)
  tipo!: TipoContato;

  @IsString()
  @MinLength(1)
  valor!: string;

  @ValidateIf((contato: ContatoPerfilDto) => contato.tipo === 'outro')
  @IsString()
  @MinLength(1)
  rotulo?: string;
}

export class ExperienciaPerfilDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  cargo!: string;

  @IsString()
  empresa!: string;

  @IsString()
  periodo!: string;

  @IsOptional()
  @IsString()
  local?: string;

  @IsString()
  @MinLength(1)
  descricao!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tecnologias?: string[];
}

export class PerfilMestreDto {
  @IsString()
  nome!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContatoPerfilDto)
  contato!: ContatoPerfilDto[];

  @IsString()
  resumo!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienciaPerfilDto)
  experiencias!: ExperienciaPerfilDto[];

  @IsArray()
  @IsString({ each: true })
  formacao!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificacoes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  idiomas?: string[];

  @IsArray()
  @IsString({ each: true })
  skills!: string[];
}
