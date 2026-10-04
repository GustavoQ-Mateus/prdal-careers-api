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

export interface MensagensNarracao {
  etapa1: string;
  etapa3: string;
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

export function dadosDaNarracao(
  analiseInicial: unknown,
  analiseFinal: unknown,
  degradacao: string | null,
): DadosNarracao | null {
  const inicial = resumoDaAnalise(analiseInicial);
  const final = resumoDaAnalise(analiseFinal);
  if (!inicial || !final) return null;
  return {
    scoreInicial: inicial.score,
    scoreFinal: final.score,
    keywordsEncontradas: inicial.keywordsEncontradas,
    keywordsAusentesIniciais: inicial.keywordsCriticasAusentes,
    pontosDeAtencao: inicial.pontosEliminatorios,
    veredicto: inicial.veredicto,
    keywordsCobertas: final.keywordsEncontradas,
    keywordsAusentes: final.keywordsCriticasAusentes,
    degradacao: degradacao?.trim() || null,
  };
}

export function dadosNarracaoValidos(valor: unknown): DadosNarracao | null {
  const dados = registro(valor);
  if (!dados || typeof dados.scoreInicial !== 'number' || typeof dados.scoreFinal !== 'number') return null;
  return {
    scoreInicial: dados.scoreInicial,
    scoreFinal: dados.scoreFinal,
    keywordsEncontradas: lista(dados.keywordsEncontradas),
    keywordsAusentesIniciais: lista(dados.keywordsAusentesIniciais),
    pontosDeAtencao: lista(dados.pontosDeAtencao),
    veredicto: typeof dados.veredicto === 'string' ? dados.veredicto : '',
    keywordsCobertas: lista(dados.keywordsCobertas),
    keywordsAusentes: lista(dados.keywordsAusentes),
    degradacao: typeof dados.degradacao === 'string' && dados.degradacao.trim() ? dados.degradacao.trim() : null,
  };
}

function itens(valores: string[]): string {
  return valores.length ? valores.join(', ') : 'Nenhuma';
}

export function narrar(dados: DadosNarracao): MensagensNarracao {
  const etapa1 = [
    'Etapa 1: Aderência do perfil-mestre',
    `Score: ${dados.scoreInicial}`,
    `Keywords encontradas: ${itens(dados.keywordsEncontradas)}`,
    `Keywords críticas ausentes: ${itens(dados.keywordsAusentesIniciais)}`,
    ...(dados.pontosDeAtencao.length ? [`Pontos de atenção: ${dados.pontosDeAtencao.join(', ')}`] : []),
    `Veredicto: ${dados.veredicto || 'Sem veredicto informado.'}`,
  ];
  const etapa3 = [
    'Etapa 3: Aderência do currículo gerado',
    `Score: ${dados.scoreFinal}. Para referência, a aderência do perfil-mestre foi ${dados.scoreInicial}.`,
    `Keywords cobertas: ${itens(dados.keywordsCobertas)}`,
    ...(dados.keywordsAusentes.length ? [`Keywords ainda ausentes: ${dados.keywordsAusentes.join(', ')}`] : []),
    ...(dados.degradacao ? [`Observação: ${dados.degradacao}`] : []),
  ];
  return { etapa1: etapa1.join('\n'), etapa3: etapa3.join('\n') };
}
