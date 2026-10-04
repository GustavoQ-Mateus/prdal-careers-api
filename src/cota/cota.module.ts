import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CotaTokensFiltro, CotaTokensGuard } from './cota-tokens.guard';
import { CotaTokensService } from './cota-tokens.service';

@Global()
@Module({
  providers: [CotaTokensService, CotaTokensGuard, { provide: APP_FILTER, useClass: CotaTokensFiltro }],
  exports: [CotaTokensService, CotaTokensGuard],
})
export class CotaModule {}
