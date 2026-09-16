import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';
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
  papel: 'user' | 'assistant' | 'tool';
  conteudo: string;
  tool?: string | null;
}

export interface PendenciaCopiloto {
  callId: string;
  tool: string;
  efeito: 'escrita';
  args: Record<string, unknown>;
}

export interface ConversaCopilotoDoc {
  _id: string;
  usuarioId: string;
  modo: 'assistido' | 'autopiloto';
  oportunidadeId: string | null;
  mensagens: MensagemCopiloto[];
  pendencia: PendenciaCopiloto | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;
  private db!: Db;

  async onModuleInit() {
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
}
