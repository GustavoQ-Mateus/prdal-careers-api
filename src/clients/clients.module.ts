import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { cabecalhoServico } from '../config/servico';
import { propagarRequestId } from '../observabilidade/propagacao';
import { AiClient } from './ai.client';
import { DocClient } from './doc.client';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({ timeout: 60000, headers: cabecalhoServico() }),
    }),
  ],
  providers: [AiClient, DocClient],
  exports: [AiClient, DocClient],
})
export class ClientsModule {
  constructor(http: HttpService) {
    propagarRequestId(http);
  }
}
