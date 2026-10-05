import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { RagModule } from '../rag/rag.module';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

@Module({
  imports: [ClientsModule, RagModule],
  controllers: [LotesController],
  providers: [LotesService],
  exports: [LotesService],
})
export class LotesModule {}
