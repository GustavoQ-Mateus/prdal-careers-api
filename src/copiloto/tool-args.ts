import { TOOLS_NATIVAS } from './tools';

const ACEITAM_OPORTUNIDADE = new Set(
  TOOLS_NATIVAS.filter((tool) => 'oportunidadeId' in (tool.input_schema.properties as object)).map((tool) => tool.name),
);

interface PrepararArgsToolInput {
  tool: string;
  args: Record<string, unknown>;
  oportunidadeId: string | null;
}

export function prepararArgsTool({ tool, args, oportunidadeId }: PrepararArgsToolInput): Record<string, unknown> {
  const preparados = { ...args };
  const oportunidade = String(preparados.oportunidadeId ?? oportunidadeId ?? '').trim();

  if (oportunidade && preparados.oportunidadeId == null && ACEITAM_OPORTUNIDADE.has(tool)) {
    preparados.oportunidadeId = oportunidade;
  }
  if (tool === 'registrar_candidatura' && oportunidade && preparados.vagaId == null) {
    preparados.vagaId = oportunidade;
  }
  return preparados;
}

export function oportunidadeDosArgs(args: Record<string, unknown>): string | null {
  const alvo = args.oportunidadeId ?? args.vagaId;
  return typeof alvo === 'string' && alvo.trim() ? alvo.trim() : null;
}
