import { writeFileSync } from 'node:fs';
import { TOOLS, TOOLS_NATIVAS } from '../copiloto/tools';

export function contratoDasTools() {
  return {
    tools: TOOLS_NATIVAS,
    efeitos: Object.fromEntries(TOOLS.map((tool) => [tool.nome, tool.efeito])),
  };
}

if (require.main === module) {
  const destino = process.argv[2];
  const texto = `${JSON.stringify(contratoDasTools(), null, 2)}\n`;
  if (destino) writeFileSync(destino, texto, 'utf8');
  else process.stdout.write(texto);
}
