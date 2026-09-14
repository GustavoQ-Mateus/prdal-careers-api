import { Module } from '@nestjs/common';
import { LotesModule } from '../lotes/lotes.module';
import { ContextoController } from './contexto.controller';
import { ContextoService } from './contexto.service';

@Module({
  imports: [LotesModule],
  controllers: [ContextoController],
  providers: [ContextoService],
})
export class ContextoModule {}
