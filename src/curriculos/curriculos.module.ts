import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { CurriculosController } from './curriculos.controller';
import { CurriculosService } from './curriculos.service';

@Module({
  imports: [ClientsModule],
  controllers: [CurriculosController],
  providers: [CurriculosService],
  exports: [CurriculosService],
})
export class CurriculosModule {}
