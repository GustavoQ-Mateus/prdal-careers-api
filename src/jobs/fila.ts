import { GetQueueAttributesCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { TipoJob } from '@prisma/client';

export interface MensagemJob {
  jobId: string;
  tipo: TipoJob;
}

export abstract class Fila {
  abstract enviar(mensagem: MensagemJob): Promise<void>;
  abstract verificar(): Promise<void>;
}

export function configuracaoSqs(env: Record<string, string | undefined> = process.env) {
  const url = env.SQS_FILA_JOBS_URL?.trim();
  if (!url) throw new Error('SQS_FILA_JOBS_URL ausente; defina a URL da fila de jobs');
  const endpoint = env.SQS_ENDPOINT?.trim() || undefined;
  return { url, endpoint, regiao: env.AWS_REGION?.trim() || 'us-east-1' };
}

export class FilaSqs extends Fila {
  private conexao: { cliente: SQSClient; url: string } | null = null;

  constructor(private readonly env: Record<string, string | undefined> = process.env) {
    super();
  }

  private conectar() {
    if (!this.conexao) {
      const { url, endpoint, regiao } = configuracaoSqs(this.env);
      this.conexao = { url, cliente: new SQSClient({ region: regiao, ...(endpoint ? { endpoint } : {}) }) };
    }
    return this.conexao;
  }

  async enviar(mensagem: MensagemJob): Promise<void> {
    const { cliente, url } = this.conectar();
    await cliente.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ jobId: mensagem.jobId, tipo: mensagem.tipo }) }));
  }

  async verificar(): Promise<void> {
    const { cliente, url } = this.conectar();
    await cliente.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['QueueArn'] }));
  }
}
