import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gerarContrato, serializarContrato } from '../contrato/gerar';

async function executar() {
  const destino = path.resolve(process.argv[2] ?? 'contrato/openapi.json');
  const documento = await gerarContrato();
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, serializarContrato(documento));
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
