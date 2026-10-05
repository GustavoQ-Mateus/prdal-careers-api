import type { MensagemCopiloto } from '../repositorios/tipos';

export type BlocoNativo =
  | { type: 'text'; text: string; [extra: string]: unknown }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string };

export interface MensagemNativa {
  role: 'user' | 'assistant';
  content: BlocoNativo[];
}

export interface Troca {
  indice: number;
  mensagens: MensagemNativa[];
}

const ID_VALIDO = /[^a-zA-Z0-9_-]/g;

export function idDeTool(valor: string): string {
  return valor.replace(ID_VALIDO, '_').slice(0, 64);
}

export function resultadoTool(
  toolUseId: string,
  conteudo: string,
  erro = false,
): Extract<BlocoNativo, { type: 'tool_result' }> {
  return { type: 'tool_result', tool_use_id: toolUseId, content: conteudo, ...(erro ? { is_error: true } : {}) };
}

function idDaMensagemTool(mensagem: MensagemCopiloto, indice: number): string {
  const resultado = mensagem.blocos?.find((bloco) => bloco.type === 'tool_result');
  if (resultado && resultado.type === 'tool_result') return resultado.tool_use_id;
  return idDeTool(mensagem.dados?.callId ?? `legado_${indice}`);
}

function blocoResultado(mensagem: MensagemCopiloto, id: string): BlocoNativo {
  const resultado = mensagem.blocos?.find((bloco) => bloco.type === 'tool_result');
  if (resultado) return resultado;
  const falhou = mensagem.dados?.ok === false || mensagem.conteudo.startsWith('falha:');
  return resultadoTool(id, mensagem.conteudo, falhou);
}

export function paraMensagensNativas(mensagens: MensagemCopiloto[], deslocamento = 0): MensagemNativa[] {
  const saida: MensagemNativa[] = [];
  const pendentes: string[] = [];

  const empurrar = (role: MensagemNativa['role'], content: BlocoNativo[]) => {
    if (content.length === 0) return;
    const ultima = saida[saida.length - 1];
    if (ultima && ultima.role === role) ultima.content.push(...content);
    else saida.push({ role, content: [...content] });
  };

  const fecharPendentes = () => {
    if (pendentes.length === 0) return;
    empurrar(
      'user',
      pendentes.splice(0).map((id) =>
        resultadoTool(id, 'sem resultado: o candidato nao confirmou esta acao e seguiu a conversa', true),
      ),
    );
  };

  mensagens.forEach((mensagem, indice) => {
    if (mensagem.papel === 'evento') return;
    if (mensagem.papel === 'user') {
      fecharPendentes();
      if (mensagem.conteudo.trim()) empurrar('user', [{ type: 'text', text: mensagem.conteudo }]);
      return;
    }
    if (mensagem.papel === 'assistant') {
      fecharPendentes();
      const blocos: BlocoNativo[] = mensagem.blocos?.length
        ? mensagem.blocos.filter((bloco) => bloco.type !== 'text' || bloco.text.trim())
        : mensagem.conteudo.trim()
          ? [{ type: 'text', text: mensagem.conteudo }]
          : [];
      for (const bloco of blocos) if (bloco.type === 'tool_use') pendentes.push(bloco.id);
      empurrar('assistant', blocos);
      return;
    }
    const id = idDaMensagemTool(mensagem, indice + deslocamento);
    const posicao = pendentes.indexOf(id);
    if (posicao >= 0) {
      pendentes.splice(posicao, 1);
    } else {
      fecharPendentes();
      empurrar('assistant', [
        { type: 'tool_use', id, name: mensagem.tool ?? 'tool_desconhecida', input: mensagem.dados?.args ?? {} },
      ]);
    }
    empurrar('user', [blocoResultado(mensagem, id)]);
  });
  fecharPendentes();
  return saida;
}

export function paraTrocas(mensagens: MensagemCopiloto[], desde = 0, base = 0): Troca[] {
  const inicios: number[] = [];
  mensagens.forEach((mensagem, indice) => {
    if (base + indice >= desde && (mensagem.papel === 'user' || inicios.length === 0)) inicios.push(indice);
  });
  return inicios
    .map((inicio, posicao) => ({
      indice: base + inicio,
      mensagens: paraMensagensNativas(mensagens.slice(inicio, inicios[posicao + 1] ?? mensagens.length), base + inicio),
    }))
    .filter((troca) => troca.mensagens.length > 0);
}
