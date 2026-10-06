export type EfeitoTool = 'leitura' | 'escrita';

export interface AvisoAcao {
  tipo: string;
  mensagem: string;
  sugestao: string;
}

export type CopilotoEvento =
  | { evento: 'token'; data: { delta: string } }
  | {
      evento: 'tool_call';
      data: {
        callId: string;
        tool: string;
        efeito: EfeitoTool;
        args: Record<string, unknown>;
        exigeConfirmacao: boolean;
      };
    }
  | {
      evento: 'confirmacao';
      data: { callId: string; tool: string; resumo: string; args: Record<string, unknown> };
    }
  | {
      evento: 'tool_resultado';
      data: {
        callId: string;
        tool: string;
        ok: boolean;
        resultado: unknown;
        erro: { mensagem: string; recuperavel: boolean } | null;
      };
    }
  | {
      evento: 'entrega_externa';
      data: { tipo: string; titulo: string; texto: string; destino?: string; aviso?: AvisoAcao };
    }
  | { evento: 'erro'; data: { escopo: string; mensagem: string; recuperavel: boolean; retryAfter?: number } }
  | { evento: 'fim_turno'; data: { motivo: string; conversaId: string } }
  | { evento: 'conversa'; data: { conversaId: string } };
