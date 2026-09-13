import { IsArray, IsObject, IsString } from 'class-validator';

export class PerfilMestreDto {
  @IsString()
  nome!: string;

  @IsObject()
  contato!: Record<string, string>;

  @IsString()
  resumo!: string;

  @IsArray()
  experiencias!: unknown[];

  @IsArray()
  formacao!: unknown[];

  @IsArray()
  skills!: unknown[];
}
