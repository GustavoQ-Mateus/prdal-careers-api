import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { RagService } from './rag.service';

@Module({
  imports: [ClientsModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
