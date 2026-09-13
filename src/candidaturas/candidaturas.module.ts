import { Module } from '@nestjs/common';
import { CandidaturasController } from './candidaturas.controller';
import { CandidaturasService } from './candidaturas.service';

@Module({
  controllers: [CandidaturasController],
  providers: [CandidaturasService],
})
export class CandidaturasModule {}
