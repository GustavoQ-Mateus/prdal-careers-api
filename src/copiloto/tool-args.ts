import { TipoAcaoOportunidade } from '@prisma/client';
import type { MensagemCopiloto } from '../mongo/mongo.service';
import { TOOLS_NATIVAS } from './tools';

const ACEITAM_OPORTUNIDADE = new Set(
  TOOLS_NATIVAS.filter((tool) => 'oportunidadeId' in (tool.input_schema.properties as object)).map((tool) => tool.name),
);
const TIPOS_ACAO_EXTERNOS = new Set<unknown>([
  TipoAcaoOportunidade.ENVIAR_CANDIDATURA,
  TipoAcaoOportunidade.FAZER_FOLLOW_UP,
  TipoAcaoOportunidade.PREPARAR_ENTREVISTA,
  TipoAcaoOportunidade.PARTICIPAR_ENTREVISTA,
  TipoAcaoOportunidade.ENVIAR_MATERIAL,
  TipoAcaoOportunidade.OUTRO,
]);
const TOOLS_APOS_ETAPA_3 = new Set([
  'redigir_mensagem_recrutador',
  'redigir_respostas_formulario',
  'registrar_candidatura',
]);

interface PrepararArgsToolInput {
  tool: string;
  args: Record<string, unknown>;
  oportunidadeId: string | null;
  mensagens: MensagemCopiloto[];
}

export interface ArgsToolPreparados {
  args: Record<string, unknown>;
  erro: string | null;
}

function leuCurriculoFinal(
  mensagens: MensagemCopiloto[],
  oportunidadeId: string | null,
): boolean {
  if (!oportunidadeId) return false;
  let ultimaGeracao = -1;
  for (let indice = mensagens.length - 1; indice >= 0; indice--) {
    const mensagem = mensagens[indice];
    if (mensagem.papel === 'tool' && mensagem.tool === 'gerar_curriculo') {
      ultimaGeracao = indice;
      break;
    }
  }
  let curriculoEsperado: string | null = null;

  if (ultimaGeracao >= 0) {
    for (let indice = ultimaGeracao + 1; indice < mensagens.length; indice++) {
      const mensagem = mensagens[indice];
      if (mensagem.papel !== 'tool' || mensagem.tool !== 'status_geracao') continue;
      try {
        const status = JSON.parse(mensagem.conteudo) as Record<string, unknown>;
        if (status.status === 'CONCLUIDA' && typeof status.curriculoId === 'string') {
          curriculoEsperado = status.curriculoId;
        }
      } catch {
        continue;
      }
    }
    if (!curriculoEsperado) return false;
  }

  return mensagens.some((mensagem, indice) => {
    if (indice <= ultimaGeracao) return false;
    if (mensagem.papel !== 'tool' || mensagem.tool !== 'buscar_curriculo') {
      return false;
    }
    try {
      const resultado = JSON.parse(mensagem.conteudo) as Record<string, unknown>;
      return (
        resultado.vagaId === oportunidadeId &&
        (!curriculoEsperado || resultado.id === curriculoEsperado) &&
        typeof resultado.score === 'number' &&
        resultado.breakdown !== null &&
        typeof resultado.breakdown === 'object'
      );
    } catch {
      return false;
    }
  });
}

function leuAnaliseEtapa1(
  mensagens: MensagemCopiloto[],
  oportunidadeId: string | null,
): boolean {
  if (!oportunidadeId) return false;
  let ultimaGeracao = -1;
  for (let indice = mensagens.length - 1; indice >= 0; indice--) {
    const mensagem = mensagens[indice];
    if (mensagem.papel === 'tool' && mensagem.tool === 'gerar_curriculo') {
      ultimaGeracao = indice;
      break;
    }
  }
  return mensagens.some((mensagem, indice) => {
    if (indice <= ultimaGeracao || mensagem.papel !== 'tool' || mensagem.tool !== 'analisar_ats') {
      return false;
    }
    try {
      const analise = JSON.parse(mensagem.conteudo) as Record<string, unknown>;
      return typeof analise.score === 'number' && typeof analise.veredicto === 'string';
    } catch {
      return false;
    }
  });
}

export function prepararArgsTool({
  tool,
  args,
  oportunidadeId,
  mensagens,
}: PrepararArgsToolInput): ArgsToolPreparados {
  const preparados = { ...args };
  const oportunidade = String(preparados.oportunidadeId ?? oportunidadeId ?? '').trim();

  if (oportunidade && preparados.oportunidadeId == null && ACEITAM_OPORTUNIDADE.has(tool)) {
    preparados.oportunidadeId = oportunidade;
  }
  if (tool === 'registrar_candidatura' && oportunidade && preparados.vagaId == null) {
    preparados.vagaId = oportunidade;
  }

  if (tool === 'gerar_curriculo' && !leuAnaliseEtapa1(mensagens, oportunidade || null)) {
    return {
      args: preparados,
      erro:
        'Etapa 1 pendente: analise a vaga com analisar_ats e aguarde a confirmacao do candidato antes de iniciar a reescrita otimizada',
    };
  }

  const exigeEtapa3 =
    TOOLS_APOS_ETAPA_3.has(tool) ||
    (tool === 'definir_proximo_passo' && TIPOS_ACAO_EXTERNOS.has(preparados.tipo));

  if (exigeEtapa3 && !leuCurriculoFinal(mensagens, oportunidade || null)) {
    return {
      args: preparados,
      erro:
        'pipeline ATS incompleta: antes desta acao, use status_geracao e, apos status CONCLUIDA, use buscar_curriculo para ler score e breakdown finais',
    };
  }

  return { args: preparados, erro: null };
}
