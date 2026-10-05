import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ContaController } from './conta.controller';
import { ContaService } from './conta.service';
import { ConsentimentoFiltro, ConsentimentoGuard } from './consentimento.guard';

@Global()
@Module({ controllers: [ContaController], providers: [ContaService, ConsentimentoGuard, { provide: APP_FILTER, useClass: ConsentimentoFiltro }], exports: [ConsentimentoGuard] })
export class ContaModule {}
