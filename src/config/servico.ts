export const HEADER_SERVICO = 'X-Prdal-Servico';

export function cabecalhoServico(): Record<string, string> {
  const token = process.env.SERVICE_TOKEN?.trim();
  return token ? { [HEADER_SERVICO]: token } : {};
}
