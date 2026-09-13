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
  criadoEm: Date;
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
}
