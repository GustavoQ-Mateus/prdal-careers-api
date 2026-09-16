import { Module } from '@nestjs/common';
import { BancoVagasModule } from '../banco-vagas/banco-vagas.module';
import { ClientsModule } from '../clients/clients.module';
import { CurriculosModule } from '../curriculos/curriculos.module';
import { AcoesController } from '../acoes/acoes.controller';
import { AcoesService } from '../acoes/acoes.service';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';

@Module({
  imports: [ClientsModule, BancoVagasModule, CurriculosModule],
  controllers: [OportunidadesController, AcoesController],
  providers: [OportunidadesService, AcoesService],
  exports: [OportunidadesService],
})
export class OportunidadesModule {}
