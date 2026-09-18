import type { MensagemCopiloto } from '../mongo/mongo.service';

export const TIPOS_ACAO_OPORTUNIDADE = [
  'REVISAR_VAGA',
  'GERAR_CURRICULO',
  'ENVIAR_CANDIDATURA',
  'FAZER_FOLLOW_UP',
  'PREPARAR_ENTREVISTA',
  'PARTICIPAR_ENTREVISTA',
  'ENVIAR_MATERIAL',
  'OUTRO',
] as const;

export type TipoAcaoCopiloto = (typeof TIPOS_ACAO_OPORTUNIDADE)[number];

const TIPOS_ACAO = new Set<string>(TIPOS_ACAO_OPORTUNIDADE);
const TIPOS_ACAO_EXTERNOS = new Set<TipoAcaoCopiloto>([
  'ENVIAR_CANDIDATURA',
  'FAZER_FOLLOW_UP',
  'PREPARAR_ENTREVISTA',
  'PARTICIPAR_ENTREVISTA',
  'ENVIAR_MATERIAL',
  'OUTRO',
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

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tipoLiteral(valor: unknown): TipoAcaoCopiloto | null {
  if (typeof valor !== 'string') return null;
  const candidato = valor.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return TIPOS_ACAO.has(candidato) ? (candidato as TipoAcaoCopiloto) : null;
}

export function normalizarTipoAcao(
  tipo: unknown,
  titulo: unknown,
): TipoAcaoCopiloto {
  const literal = tipoLiteral(tipo);
  if (literal) return literal;

  const intencao = normalizarTexto(`${String(tipo ?? '')} ${String(titulo ?? '')}`);
  if (/\b(follow up|followup|acompanhar retorno|cobrar retorno)\b/.test(intencao)) {
    return 'FAZER_FOLLOW_UP';
  }
  if (/\b(preparar|treinar|simular)\b.*\bentrevista\b/.test(intencao)) {
    return 'PREPARAR_ENTREVISTA';
  }
  if (/\b(participar|fazer|realizar)\b.*\bentrevista\b/.test(intencao)) {
    return 'PARTICIPAR_ENTREVISTA';
  }
  if (/\b(enviar|encaminhar|anexar)\b.*\b(material|documento|portfolio|case|teste)\b/.test(intencao)) {
    return 'ENVIAR_MATERIAL';
  }
  if (/\b(gerar|criar|montar)\b.*\bcurriculo\b/.test(intencao)) {
    return 'GERAR_CURRICULO';
  }
  if (/\b(revisar|analisar|avaliar)\b.*\b(vaga|curriculo)\b/.test(intencao)) {
    return 'REVISAR_VAGA';
  }
  if (
    /\b(enviar|mandar|redigir|escrever|preparar)\b.*\b(mensagem|recrutador|candidatura)\b/.test(
      intencao,
    ) ||
    /\b(aplicar|candidatar|inscrever)\b/.test(intencao)
  ) {
    return 'ENVIAR_CANDIDATURA';
  }
  return 'OUTRO';
}

function ehConsultaStatusComoAgenda(titulo: unknown): boolean {
  const texto = normalizarTexto(titulo);
  return (
    /\b(status|verificar|consultar|acompanhar)\b/.test(texto) &&
    /\b(geracao|curriculo)\b/.test(texto)
  );
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

export function prepararArgsTool({
  tool,
  args,
  oportunidadeId,
  mensagens,
}: PrepararArgsToolInput): ArgsToolPreparados {
  const preparados = { ...args };
  const oportunidade = String(preparados.oportunidadeId ?? oportunidadeId ?? '').trim();

  if (oportunidade && preparados.oportunidadeId == null) {
    preparados.oportunidadeId = oportunidade;
  }
  if (tool === 'registrar_candidatura' && oportunidade && preparados.vagaId == null) {
    preparados.vagaId = oportunidade;
  }

  if (tool === 'definir_proximo_passo') {
    if (ehConsultaStatusComoAgenda(preparados.titulo)) {
      return {
        args: preparados,
        erro:
          'status de geracao de curriculo nao e proximo passo de agenda; use status_geracao e, quando concluir, buscar_curriculo',
      };
    }
    if (!String(preparados.titulo ?? '').trim()) {
      return {
        args: preparados,
        erro: 'titulo e obrigatorio para definir_proximo_passo',
      };
    }
    if (
      /\b(redigir|escrever|preparar)\b.*\bmensagem\b.*\brecrutador\b/.test(
        normalizarTexto(preparados.titulo),
      )
    ) {
      return {
        args: preparados,
        erro:
          'para preparar mensagem ao recrutador, use redigir_mensagem_recrutador; definir_proximo_passo serve apenas para agendar o envio',
      };
    }
    preparados.tipo = normalizarTipoAcao(preparados.tipo, preparados.titulo);
  }

  const exigeEtapa3 =
    TOOLS_APOS_ETAPA_3.has(tool) ||
    (tool === 'definir_proximo_passo' &&
      TIPOS_ACAO_EXTERNOS.has(preparados.tipo as TipoAcaoCopiloto));

  if (exigeEtapa3 && !leuCurriculoFinal(mensagens, oportunidade || null)) {
    return {
      args: preparados,
      erro:
        'pipeline ATS incompleta: antes desta acao, use status_geracao e, apos status CONCLUIDA, use buscar_curriculo para ler score e breakdown finais',
    };
  }

  return { args: preparados, erro: null };
}
