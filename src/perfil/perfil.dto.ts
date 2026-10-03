import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';
import { TIPOS_CONTATO, type TipoContato } from './perfil.normalizacao';

export class ContatoPerfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsIn(TIPOS_CONTATO)
  tipo!: TipoContato;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.textoCurto)
  valor!: string;

  @ValidateIf((contato: ContatoPerfilDto) => contato.tipo === 'outro')
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.titulo)
  rotulo?: string;
}

export class ExperienciaPerfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsString()
  @MaxLength(LIMITE.titulo)
  cargo!: string;

  @IsString()
  @MaxLength(LIMITE.empresa)
  empresa!: string;

  @IsString()
  @MaxLength(LIMITE.titulo)
  periodo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  local?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.descricaoExperiencia)
  descricao!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITE.skills)
  @IsString({ each: true })
  @MaxLength(LIMITE.termo, { each: true })
  tecnologias?: string[];
}

export class PerfilMestreDto {
  @IsString()
  @MaxLength(LIMITE.titulo)
  nome!: string;

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => ContatoPerfilDto)
  contato!: ContatoPerfilDto[];

  @IsString()
  @MaxLength(LIMITE.resumoPerfil)
  resumo!: string;

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => ExperienciaPerfilDto)
  experiencias!: ExperienciaPerfilDto[];

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @IsString({ each: true })
  @MaxLength(LIMITE.itemLista, { each: true })
  formacao!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @IsString({ each: true })
  @MaxLength(LIMITE.itemLista, { each: true })
  certificacoes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @IsString({ each: true })
  @MaxLength(LIMITE.termo, { each: true })
  idiomas?: string[];

  @IsArray()
  @ArrayMaxSize(LIMITE.skills)
  @IsString({ each: true })
  @MaxLength(LIMITE.termo, { each: true })
  skills!: string[];
}
