import type { ResumoAnalise } from './maquina';

export interface DadosNarracao {
  scoreInicial: number;
  scoreFinal: number;
  keywordsEncontradas: string[];
  keywordsAusentesIniciais: string[];
  pontosDeAtencao: string[];
  veredicto: string;
  keywordsCobertas: string[];
  keywordsAusentes: string[];
  degradacao: string | null;
}

function lista(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => String(item).trim()).filter(Boolean);
}

function registro(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

export function resumoDaAnalise(analise: unknown): ResumoAnalise | null {
  const dados = registro(analise);
  if (!dados || typeof dados.score !== 'number') return null;
  return {
    score: dados.score,
    keywordsEncontradas: lista(dados.keywordsEncontradas),
    keywordsCriticasAusentes: lista(dados.keywordsCriticasAusentes),
    pontosEliminatorios: lista(dados.pontosEliminatorios),
    veredicto: typeof dados.veredicto === 'string' ? dados.veredicto.trim() : '',
  };
}
