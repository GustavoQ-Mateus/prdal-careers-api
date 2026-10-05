import { IsString, MaxLength, MinLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class AgendarExclusaoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.senha)
  senha!: string;
}
