import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { LIMITE } from '../dominio/limites';

export const TAMANHO_MINIMO_SENHA = 10;

const normalizarEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(normalizarEmail)
  @IsEmail()
  @MaxLength(LIMITE.email)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.senha)
  senha!: string;
}

export class CadastroDto {
  @Transform(normalizarEmail)
  @IsEmail()
  @MaxLength(LIMITE.email)
  email!: string;

  @IsString()
  @MinLength(TAMANHO_MINIMO_SENHA, {
    message: `a senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`,
  })
  @MaxLength(LIMITE.senha)
  senha!: string;
}

export class TrocaSenhaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITE.senha)
  senhaAtual!: string;

  @IsString()
  @MinLength(TAMANHO_MINIMO_SENHA, {
    message: `a senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`,
  })
  @MaxLength(LIMITE.senha)
  novaSenha!: string;
}
