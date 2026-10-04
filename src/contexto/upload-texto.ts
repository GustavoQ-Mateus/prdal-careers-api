import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';

export const UPLOAD_PADRAO_MAX_ARQUIVOS = 10;
export const UPLOAD_PADRAO_MAX_BYTES = 1024 * 1024;

const EXTENSAO_TEXTO = /\.(md|txt)$/i;
const CONTROLE_BINARIO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export interface ArquivoRecebido {
  originalname: string;
  buffer: Buffer;
}

export interface ArquivoTexto {
  titulo: string;
  corpo: string;
}

function inteiroPositivo(nome: string, padrao: number): number {
  const valor = Number(process.env[nome]);
  return Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

export function limitesUpload() {
  return {
    arquivos: inteiroPositivo('UPLOAD_MAX_ARQUIVOS', UPLOAD_PADRAO_MAX_ARQUIVOS),
    bytes: inteiroPositivo('UPLOAD_MAX_BYTES', UPLOAD_PADRAO_MAX_BYTES),
  };
}

export function opcoesMulter() {
  const limites = limitesUpload();
  return { limits: { files: limites.arquivos, fileSize: limites.bytes } };
}

@Injectable()
export class LimiteUploadInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const limites = limitesUpload();
    return next.handle().pipe(
      catchError((erro: unknown) => {
        if (erro instanceof PayloadTooLargeException) {
          return throwError(() => new PayloadTooLargeException(`cada arquivo pode ter no maximo ${limites.bytes} bytes`));
        }
        if (erro instanceof BadRequestException && erro.message === 'Too many files') {
          return throwError(() => new PayloadTooLargeException(`envie no maximo ${limites.arquivos} arquivos por vez`));
        }
        return throwError(() => erro);
      }),
    );
  }
}

export function lerHistorico(valor: unknown): boolean {
  if (valor === undefined || valor === null || valor === '') return false;
  if (valor === true || valor === 'true') return true;
  if (valor === false || valor === 'false') return false;
  throw new BadRequestException('historico deve ser true ou false');
}

const decodificador = new TextDecoder('utf-8', { fatal: true });

export function lerArquivosTexto(arquivos: ArquivoRecebido[]): ArquivoTexto[] {
  return arquivos.map((arquivo) => {
    if (!EXTENSAO_TEXTO.test(arquivo.originalname)) {
      throw new UnsupportedMediaTypeException(`${arquivo.originalname}: envie apenas arquivos .md ou .txt`);
    }
    let corpo: string;
    try {
      corpo = decodificador.decode(arquivo.buffer);
    } catch {
      throw new UnsupportedMediaTypeException(`${arquivo.originalname}: o conteudo nao e texto UTF-8 valido`);
    }
    if (CONTROLE_BINARIO.test(corpo)) {
      throw new UnsupportedMediaTypeException(`${arquivo.originalname}: o conteudo tem bytes binarios`);
    }
    return {
      titulo: arquivo.originalname.replace(EXTENSAO_TEXTO, ''),
      corpo: corpo.replace(/^\uFEFF/, ''),
    };
  });
}
