import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { CurriculosModule } from '../curriculos/curriculos.module';
import { LotesModule } from '../lotes/lotes.module';
import { AcoesController } from '../acoes/acoes.controller';
import { AcoesService } from '../acoes/acoes.service';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';

@Module({
  imports: [ClientsModule, LotesModule, CurriculosModule],
  controllers: [OportunidadesController, AcoesController],
  providers: [OportunidadesService, AcoesService],
  exports: [OportunidadesService, AcoesService],
})
export class OportunidadesModule {}
