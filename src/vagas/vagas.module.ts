import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { CurriculosModule } from '../curriculos/curriculos.module';
import { VagasController } from './vagas.controller';
import { VagasService } from './vagas.service';

@Module({
  imports: [ClientsModule, CurriculosModule],
  controllers: [VagasController],
  providers: [VagasService],
})
export class VagasModule {}
