import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { Keyword } from '../clients/ai.client';

export interface BancoVagaDoc {
  _id: string;
  usuarioId: string;
  titulo: string;
  empresa: string;
  fonte: string | null;
  descricao: string;
  status: 'CRUA' | 'ATIVADA';
  categoria: string | null;
  nivel: string | null;
  keywords: Keyword[] | null;
  origemRelacionalId?: string | null;
  criadoEm: Date;
}

export interface DocumentoRagDoc {
  _id: string;
  usuarioId: string;
  origem: 'perfil' | 'candidatura' | 'nota';
  origemId: string;
  titulo: string;
  texto: string;
  criadoEm: Date;
}

export interface NotaObsidianDoc {
  _id: string;
  usuarioId: string;
  titulo: string;
  corpo: string;
  criadoEm: Date;
}

export interface MensagemCopiloto {
  papel: 'user' | 'assistant' | 'tool' | 'evento';
  conteudo: string;
  tool?: string | null;
  dados?: {
    callId?: string;
    efeito?: 'leitura' | 'escrita' | 'entrega_externa';
    args?: Record<string, unknown>;
    ok?: boolean;
    resultado?: unknown;
    erro?: string;
    entrega?: { tipo: string; titulo: string; texto: string; destino?: string };
    evento?: 'erro';
    escopo?: string;
    origem?: 'geracao_assincrona';
    jobId?: string;
  };
}

export interface PendenciaCopiloto {
  callId: string;
  tool: string;
  efeito: 'escrita';
  args: Record<string, unknown>;
  resumo?: string;
  executando?: boolean;
}

export interface ConfirmacaoCopiloto {
  callId: string;
  tool: string;
  decisao: 'confirmar' | 'recusar';
  resultado?: unknown;
  erro?: string;
  concluidaEm: Date;
}

export interface ConversaCopilotoDoc {
  _id: string;
  usuarioId: string;
  modo: 'assistido' | 'autopiloto';
  oportunidadeId: string | null;
  mensagens: MensagemCopiloto[];
  pendencia: PendenciaCopiloto | null;
  confirmacoes?: ConfirmacaoCopiloto[];
  criadoEm: Date;
  atualizadoEm: Date;
}

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;
  private db!: Db;
  private readonly pronto: Promise<void>;

  constructor() {
    this.pronto = this.conectar();
  }

  async onModuleInit() {
    await this.pronto;
  }

  private async conectar(): Promise<void> {
    const url = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
    this.client = new MongoClient(url);
    await this.client.connect();
    this.db = this.client.db(process.env.MONGO_DB ?? 'prdal_careers');
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  bancoVagas(): Collection<BancoVagaDoc> {
    return this.db.collection<BancoVagaDoc>('banco_vagas');
  }

  documentosRag(): Collection<DocumentoRagDoc> {
    return this.db.collection<DocumentoRagDoc>('documentos_rag');
  }

  notasObsidian(): Collection<NotaObsidianDoc> {
    return this.db.collection<NotaObsidianDoc>('notas_obsidian');
  }

  conversasCopiloto(): Collection<ConversaCopilotoDoc> {
    return this.db.collection<ConversaCopilotoDoc>('copiloto_conversas');
  }

  async anexarConclusaoGeracao(
    usuarioId: string,
    jobId: string,
    curriculo: Record<string, unknown>,
    narracao: string,
  ): Promise<boolean> {
    await this.pronto;
    const callId = randomUUID();
    const atualizado = await this.conversasCopiloto().updateOne(
      {
        $and: [
          { usuarioId },
          { mensagens: { $elemMatch: { tool: 'gerar_curriculo', 'dados.resultado.jobId': jobId } } },
          { mensagens: { $not: { $elemMatch: { 'dados.origem': 'geracao_assincrona', 'dados.jobId': jobId } } } },
        ],
      },
      {
        $push: {
          mensagens: {
            $each: [
              {
                papel: 'tool',
                tool: 'buscar_curriculo',
                conteudo: JSON.stringify(curriculo),
                dados: {
                  callId,
                  efeito: 'leitura',
                  args: { curriculoId: curriculo.id },
                  ok: true,
                  resultado: curriculo,
                  origem: 'geracao_assincrona',
                  jobId,
                },
              },
              {
                papel: 'assistant',
                conteudo: narracao,
                dados: { origem: 'geracao_assincrona', jobId },
              },
            ],
          },
        },
        $set: { atualizadoEm: new Date() },
      },
    );
    return atualizado.modifiedCount > 0;
  }
}
