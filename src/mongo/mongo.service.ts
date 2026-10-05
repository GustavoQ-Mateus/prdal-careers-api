import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

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

  async ping(): Promise<void> {
    await this.pronto;
    await this.db.command({ ping: 1 });
  }

  async onModuleDestroy() {
    await this.client?.close();
  }
}
