import { Module } from '@nestjs/common';
import { LotesModule } from '../lotes/lotes.module';
import { BancoVagasController } from './banco-vagas.controller';
import { BancoVagasService } from './banco-vagas.service';

@Module({
  imports: [LotesModule],
  controllers: [BancoVagasController],
  providers: [BancoVagasService],
})
export class BancoVagasModule {}
