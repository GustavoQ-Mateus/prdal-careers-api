import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LIMITE } from '../dominio/limites';

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

export class ImportarBancoVagasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITE.itens)
  @ValidateNested({ each: true })
  @Type(() => ItemImportacaoDto)
  itens!: ItemImportacaoDto[];
}
