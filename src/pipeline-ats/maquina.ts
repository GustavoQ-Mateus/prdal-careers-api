import { TipoAcaoOportunidade } from '@prisma/client';
import type { DadosNarracao } from './narracao';

export const ESTADOS_ATS = [
  'SEM_ANALISE',
  'ANALISADA',
  'AGUARDANDO_CONFIRMACAO',
  'GERANDO',
  'CONCLUIDA',
  'FALHOU',
  'DESATUALIZADA',
] as const;

export type EstadoAts = (typeof ESTADOS_ATS)[number];

export interface SituacaoAts {
  estado: EstadoAts;
  jobId: string | null;
  curriculoId: string | null;
  perfilAlteradoNaGeracao: boolean;
}

export interface ResumoAnalise {
  score: number;
  keywordsEncontradas: string[];
  keywordsCriticasAusentes: string[];
  pontosEliminatorios: string[];
  veredicto: string;
}

export type OrigemGeracao = 'confirmacao' | 'direta';

export type EventoAts =
  | { tipo: 'analise_concluida'; analise: ResumoAnalise }
  | { tipo: 'confirmacao_solicitada' }
  | { tipo: 'confirmacao_recusada' }
  | { tipo: 'geracao_iniciada'; jobId: string; origem: OrigemGeracao }
  | { tipo: 'geracao_concluida'; jobId: string; curriculoId: string; narracao: DadosNarracao | null }
  | { tipo: 'geracao_falhou'; jobId: string; erro: string }
  | { tipo: 'perfil_alterado' };

export type TipoEventoAts = EventoAts['tipo'];

export type Transicao =
  | { aceita: true; situacao: SituacaoAts; registrar: boolean }
  | { aceita: false; motivo: string; proximoPasso: string };

export const SITUACAO_INICIAL: SituacaoAts = {
  estado: 'SEM_ANALISE',
  jobId: null,
  curriculoId: null,
  perfilAlteradoNaGeracao: false,
};

export const ROTULOS_ATS: Record<EstadoAts, string> = {
  SEM_ANALISE: 'sem análise ATS',
  ANALISADA: 'análise ATS concluída',
  AGUARDANDO_CONFIRMACAO: 'aguardando a confirmação do candidato para a reescrita',
  GERANDO: 'currículo em geração',
  CONCLUIDA: 'currículo concluído',
  FALHOU: 'a última geração falhou',
  DESATUALIZADA: 'currículo desatualizado: o perfil mudou depois da geração',
};

export const PROXIMOS_PASSOS: Record<EstadoAts, string> = {
  SEM_ANALISE: 'analisar_ats, para a análise ATS do perfil contra a vaga',
  ANALISADA: 'gerar_curriculo, que pede a confirmação do candidato antes da reescrita',
  AGUARDANDO_CONFIRMACAO:
    'aguardar a confirmação do candidato; se ele pedir a reescrita de novo, gerar_curriculo reapresenta o pedido',
  GERANDO: 'status_geracao, para acompanhar; a conclusão chega sozinha na conversa',
  CONCLUIDA: 'buscar_curriculo, para ler o currículo final, ou as ações externas da candidatura',
  FALHOU: 'analisar_ats, para recomeçar o ciclo',
  DESATUALIZADA: 'analisar_ats, para refazer a análise com o perfil atual e depois gerar de novo',
};

const PODE_GERAR: ReadonlySet<EstadoAts> = new Set(['ANALISADA', 'AGUARDANDO_CONFIRMACAO']);
const TEM_CURRICULO: ReadonlySet<EstadoAts> = new Set(['CONCLUIDA', 'DESATUALIZADA']);

function recusa(atual: SituacaoAts, motivo: string): Transicao {
  return { aceita: false, motivo, proximoPasso: PROXIMOS_PASSOS[atual.estado] };
}

function vai(atual: SituacaoAts, parcial: Partial<SituacaoAts>, registrar = true): Transicao {
  return { aceita: true, situacao: { ...atual, ...parcial }, registrar };
}

export function transicionar(atual: SituacaoAts, evento: EventoAts): Transicao {
  switch (evento.tipo) {
    case 'analise_concluida':
      if (atual.estado === 'GERANDO') return recusa(atual, 'há uma geração em andamento');
      return vai(atual, { estado: 'ANALISADA', jobId: null, perfilAlteradoNaGeracao: false });

    case 'confirmacao_solicitada':
      if (!PODE_GERAR.has(atual.estado)) return recusa(atual, 'a reescrita exige uma análise ATS atual');
      return vai(atual, { estado: 'AGUARDANDO_CONFIRMACAO' });

    case 'confirmacao_recusada':
      if (atual.estado !== 'AGUARDANDO_CONFIRMACAO') return recusa(atual, 'não há confirmação pendente');
      return vai(atual, { estado: 'ANALISADA' });

    case 'geracao_iniciada':
      if (atual.estado === 'GERANDO') return recusa(atual, 'há uma geração em andamento');
      if (evento.origem === 'confirmacao' && atual.estado !== 'AGUARDANDO_CONFIRMACAO') {
        return recusa(atual, 'a reescrita só começa depois da confirmação do candidato');
      }
      return vai(atual, { estado: 'GERANDO', jobId: evento.jobId, perfilAlteradoNaGeracao: false });

    case 'geracao_concluida':
      if (atual.estado !== 'GERANDO' || atual.jobId !== evento.jobId) {
        return recusa(atual, 'esta geração não é a que está em andamento');
      }
      return vai(atual, {
        estado: atual.perfilAlteradoNaGeracao ? 'DESATUALIZADA' : 'CONCLUIDA',
        curriculoId: evento.curriculoId,
        perfilAlteradoNaGeracao: false,
      });

    case 'geracao_falhou':
      if (atual.estado !== 'GERANDO' || atual.jobId !== evento.jobId) {
        return recusa(atual, 'esta geração não é a que está em andamento');
      }
      return vai(atual, { estado: 'FALHOU', perfilAlteradoNaGeracao: false });

    case 'perfil_alterado':
      if (atual.estado === 'CONCLUIDA') return vai(atual, { estado: 'DESATUALIZADA' });
      if (atual.estado === 'ANALISADA' || atual.estado === 'AGUARDANDO_CONFIRMACAO') {
        return vai(atual, { estado: 'SEM_ANALISE' });
      }
      if (atual.estado === 'GERANDO' && !atual.perfilAlteradoNaGeracao) {
        return vai(atual, { perfilAlteradoNaGeracao: true });
      }
      return vai(atual, {}, false);
  }
}

const TIPOS_ACAO_EXTERNOS: ReadonlySet<unknown> = new Set([
  TipoAcaoOportunidade.ENVIAR_CANDIDATURA,
  TipoAcaoOportunidade.FAZER_FOLLOW_UP,
  TipoAcaoOportunidade.PREPARAR_ENTREVISTA,
  TipoAcaoOportunidade.PARTICIPAR_ENTREVISTA,
  TipoAcaoOportunidade.ENVIAR_MATERIAL,
  TipoAcaoOportunidade.OUTRO,
]);

const TOOLS_EXTERNAS = new Set([
  'redigir_mensagem_recrutador',
  'redigir_respostas_formulario',
  'registrar_candidatura',
]);

export function toolDependeDoPipeline(tool: string, args: Record<string, unknown>): boolean {
  return (
    tool === 'analisar_ats' ||
    tool === 'gerar_curriculo' ||
    TOOLS_EXTERNAS.has(tool) ||
    (tool === 'definir_proximo_passo' && TIPOS_ACAO_EXTERNOS.has(args.tipo))
  );
}

export interface ForaDeOrdem {
  motivo: string;
  proximoPasso: string;
}

export function verificarOrdem(
  tool: string,
  args: Record<string, unknown>,
  situacao: SituacaoAts,
): ForaDeOrdem | null {
  if (!toolDependeDoPipeline(tool, args)) return null;
  const estado = situacao.estado;
  const proximoPasso = PROXIMOS_PASSOS[estado];
  if (tool === 'analisar_ats') {
    return estado === 'GERANDO' ? { motivo: 'há uma geração em andamento', proximoPasso } : null;
  }
  if (tool === 'gerar_curriculo') {
    return PODE_GERAR.has(estado) ? null : { motivo: 'a reescrita exige uma análise ATS atual', proximoPasso };
  }
  return TEM_CURRICULO.has(estado)
    ? null
    : { motivo: 'esta ação exige um currículo gerado e concluído para a vaga', proximoPasso };
}

export function mensagemForaDeOrdem(tool: string, situacao: SituacaoAts, fora: ForaDeOrdem): string {
  return (
    `Etapa fora de ordem: ${tool} não vale agora porque ${fora.motivo}. ` +
    `Estado do pipeline ATS desta oportunidade: ${ROTULOS_ATS[situacao.estado]}. ` +
    `Próximo passo válido: ${fora.proximoPasso}.`
  );
}

export interface GeracaoLegada {
  id: string;
  status: string;
  curriculoId: string | null;
}

export function situacaoDeLegado(geracao: GeracaoLegada | null): SituacaoAts {
  if (!geracao) return SITUACAO_INICIAL;
  if (geracao.status === 'CONCLUIDA') {
    return { ...SITUACAO_INICIAL, estado: 'CONCLUIDA', jobId: geracao.id, curriculoId: geracao.curriculoId };
  }
  if (geracao.status === 'ERRO') return { ...SITUACAO_INICIAL, estado: 'FALHOU', jobId: geracao.id };
  return { ...SITUACAO_INICIAL, estado: 'GERANDO', jobId: geracao.id };
}

export function descreverParaAgente(situacao: SituacaoAts): string {
  return `${situacao.estado} (${ROTULOS_ATS[situacao.estado]}); próximo passo válido: ${PROXIMOS_PASSOS[situacao.estado]}`;
}
