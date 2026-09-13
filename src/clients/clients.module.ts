import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AiClient } from './ai.client';
import { DocClient } from './doc.client';

@Module({
  imports: [HttpModule.register({ timeout: 60000 })],
  providers: [AiClient, DocClient],
  exports: [AiClient, DocClient],
})
export class ClientsModule {}
