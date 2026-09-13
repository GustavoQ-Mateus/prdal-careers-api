import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STORAGE_DIR = process.env.STORAGE_DIR ?? '/app/storage';

export async function salvarArquivo(nome: string, dados: Buffer): Promise<string> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const caminho = path.join(STORAGE_DIR, nome);
  await writeFile(caminho, dados);
  return caminho;
}

export function lerArquivo(caminho: string): Promise<Buffer> {
  return readFile(caminho);
}
