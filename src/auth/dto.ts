import { IsEmail, MinLength } from 'class-validator';

export class CredenciaisDto {
  @IsEmail()
  email!: string;

  @MinLength(6)
  senha!: string;
}
