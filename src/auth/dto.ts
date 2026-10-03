import { IsEmail, MaxLength, MinLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export class CredenciaisDto {
  @IsEmail()
  @MaxLength(LIMITE.email)
  email!: string;

  @MinLength(6)
  @MaxLength(LIMITE.senha)
  senha!: string;
}
