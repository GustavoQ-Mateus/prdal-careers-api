import { adicionarDiasCivis, dataCivil } from '../dominio/fuso';

export type SerieTemporalPonto = {
  data: string;
  oportunidadesCriadas: number;
  acoesConcluidas: number;
  curriculosGerados: number;
  scoreMedio: number | null;
};

export type SerieTemporal = {
  inicio: string;
  fim: string;
  periodoDias: 7 | 30 | 90;
  pontos: SerieTemporalPonto[];
};

type RegistroData = { data: Date };
type CurriculoData = RegistroData & { score: number | null };

export function periodoValido(valor?: string): 7 | 30 | 90 {
  if (!valor || valor === '30') return 30;
  if (valor === '7') return 7;
  if (valor === '90') return 90;
  throw new Error('periodo deve ser 7, 30 ou 90 dias');
}

export function agregarSerieTemporal(params: {
  hoje: string;
  fuso: string;
  periodoDias: 7 | 30 | 90;
  oportunidades: RegistroData[];
  acoesConcluidas: RegistroData[];
  curriculos: CurriculoData[];
}): SerieTemporal {
  const inicio = adicionarDiasCivis(params.hoje, -(params.periodoDias - 1));
  const fim = params.hoje;
  const pontos = new Map<string, SerieTemporalPonto>();

  for (let data = inicio; data <= fim; data = adicionarDiasCivis(data, 1)) {
    pontos.set(data, {
      data,
      oportunidadesCriadas: 0,
      acoesConcluidas: 0,
      curriculosGerados: 0,
      scoreMedio: null,
    });
  }

  for (const oportunidade of params.oportunidades) {
    const ponto = pontos.get(dataCivil(oportunidade.data, params.fuso));
    if (ponto) ponto.oportunidadesCriadas += 1;
  }
  for (const acao of params.acoesConcluidas) {
    const ponto = pontos.get(dataCivil(acao.data, params.fuso));
    if (ponto) ponto.acoesConcluidas += 1;
  }

  const scoresPorData = new Map<string, number[]>();
  for (const curriculo of params.curriculos) {
    const data = dataCivil(curriculo.data, params.fuso);
    const ponto = pontos.get(data);
    if (!ponto) continue;
    ponto.curriculosGerados += 1;
    if (curriculo.score !== null) {
      const scores = scoresPorData.get(data) ?? [];
      scores.push(curriculo.score);
      scoresPorData.set(data, scores);
    }
  }
  for (const [data, scores] of scoresPorData) {
    const ponto = pontos.get(data);
    if (ponto) ponto.scoreMedio = Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
  }

  return { inicio, fim, periodoDias: params.periodoDias, pontos: [...pontos.values()] };
}
