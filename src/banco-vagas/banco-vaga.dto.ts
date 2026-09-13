import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ItemImportacaoDto {
  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsString()
  @MinLength(1)
  empresa!: string;

  @IsOptional()
  @IsString()
  fonte?: string;

  @IsString()
  @MinLength(1)
  descricao!: string;
}

export class ImportarBancoVagasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemImportacaoDto)
  itens!: ItemImportacaoDto[];
}
