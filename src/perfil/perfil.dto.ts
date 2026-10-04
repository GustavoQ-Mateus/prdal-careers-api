import { plainToInstance, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  validateSync,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';
import {
  MOTIVOS_REVISAO,
  STATUS_FORMACAO,
  TIPOS_LINK,
  type MotivoRevisao,
  type StatusFormacao,
  type TipoLink,
} from './perfil.normalizacao';

const UF_RE = /^[A-Z]{2}$/;

function ehBrasil(pais: unknown): boolean {
  return typeof pais === 'string' && pais.normalize('NFD').replace(/[^A-Za-z]/g, '').toLowerCase() === 'brasil';
}

function ehObjeto(valor: unknown): boolean {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

@ValidatorConstraint({ name: 'ufQuandoBrasil' })
class UfQuandoBrasil implements ValidatorConstraintInterface {
  validate(estado: unknown, args: ValidationArguments) {
    return !ehBrasil((args.object as { pais?: unknown }).pais) || (typeof estado === 'string' && UF_RE.test(estado));
  }

  defaultMessage() {
    return 'estado deve ser a sigla de 2 letras quando o pais for Brasil';
  }
}

@ValidatorConstraint({ name: 'textoOuObjeto' })
class TextoOuObjeto implements ValidatorConstraintInterface {
  validate(valor: unknown, args: ValidationArguments) {
    if (valor === null || valor === undefined) return true;
    if (typeof valor === 'string') return valor.length <= LIMITE.textoCurto;
    if (!ehObjeto(valor)) return false;
    const [classe] = args.constraints as [new () => object];
    return validateSync(plainToInstance(classe, valor)).length === 0;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} deve ser texto de ate ${LIMITE.textoCurto} caracteres ou objeto valido`;
  }
}

class RevisavelDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MOTIVOS_REVISAO.length)
  @IsIn(MOTIVOS_REVISAO, { each: true })
  revisao?: MotivoRevisao[];
}

export class EmailPerfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.email)
  valor!: string;

  @IsBoolean()
  principal!: boolean;
}

export class TelefonePerfilDto extends RevisavelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsString()
  @Matches(/^(\+\d{1,4})?$/)
  ddi!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.textoCurto)
  numero!: string;

  @IsBoolean()
  principal!: boolean;
}

export class LinkPerfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsIn(TIPOS_LINK)
  tipo!: TipoLink;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.url)
  url!: string;
}

export class LocalPerfilDto {
  @IsString()
  @MaxLength(LIMITE.titulo)
  pais!: string;

  @IsString()
  @MaxLength(LIMITE.titulo)
  @Validate(UfQuandoBrasil)
  estado!: string;

  @IsString()
  @MaxLength(LIMITE.titulo)
  cidade!: string;
}

export class EnderecoPerfilDto extends LocalPerfilDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.textoCurto)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  complemento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.textoCurto)
  legado?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MOTIVOS_REVISAO.length)
  @IsIn(MOTIVOS_REVISAO, { each: true })
  revisao?: MotivoRevisao[];
}

export class OutroContatoPerfilDto extends RevisavelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsString()
  @MaxLength(LIMITE.titulo)
  rotulo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.textoCurto)
  valor!: string;
}

export class FormacaoPerfilDto extends RevisavelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsString()
  @MaxLength(LIMITE.titulo)
  grau!: string;

  @IsIn([...STATUS_FORMACAO, ''])
  status!: StatusFormacao | '';

  @IsString()
  @MaxLength(LIMITE.titulo)
  instituicao!: string;

  @IsString()
  @MaxLength(LIMITE.itemLista)
  curso!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  inicioMes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  inicioAno?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fimMes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  fimAno?: number | null;
}

export class CertificacaoPerfilDto extends RevisavelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.id)
  id!: string;

  @IsString()
  @MaxLength(LIMITE.itemLista)
  titulo!: string;

  @IsString()
  @MaxLength(LIMITE.itemLista)
  descricao!: string;
}

export class ExperienciaPerfilDto extends RevisavelDto {
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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  dataInicioMes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  dataInicioAno?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  dataFimMes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  dataFimAno?: number | null;

  @IsOptional()
  @IsBoolean()
  atual?: boolean;

  @Validate(TextoOuObjeto, [LocalPerfilDto])
  local?: LocalPerfilDto | string | null;

  @IsString()
  @MaxLength(LIMITE.descricaoExperiencia)
  descricao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  periodo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.titulo)
  periodoLegado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITE.textoCurto)
  localLegado?: string;
}

export class PerfilMestreDto {
  @IsString()
  @MaxLength(LIMITE.titulo)
  nome!: string;

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => EmailPerfilDto)
  emails!: EmailPerfilDto[];

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => TelefonePerfilDto)
  telefones!: TelefonePerfilDto[];

  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => LinkPerfilDto)
  links!: LinkPerfilDto[];

  @Validate(TextoOuObjeto, [EnderecoPerfilDto])
  endereco?: EnderecoPerfilDto | string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => OutroContatoPerfilDto)
  outrosContatos?: OutroContatoPerfilDto[];

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
  @ValidateNested({ each: true })
  @Type(() => FormacaoPerfilDto)
  formacao!: FormacaoPerfilDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => CertificacaoPerfilDto)
  certificacoes?: CertificacaoPerfilDto[];

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
