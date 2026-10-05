import { Module } from '@nestjs/common';
import { BancoVagasModule } from '../banco-vagas/banco-vagas.module';
import { CandidaturasModule } from '../candidaturas/candidaturas.module';
import { ClientsModule } from '../clients/clients.module';
import { CurriculosModule } from '../curriculos/curriculos.module';
import { HojeModule } from '../hoje/hoje.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { PerfilModule } from '../perfil/perfil.module';
import { CapacidadesService } from './capacidades.service';
import { ChatService } from './chat.service';
import { ConversasService } from './conversas.service';
import { CopilotoController } from './copiloto.controller';
import { ToolExecutor } from './tool-executor';
import { TurnosService } from './turnos.service';

@Module({
  imports: [
    ClientsModule,
    OportunidadesModule,
    PerfilModule,
    CurriculosModule,
    BancoVagasModule,
    CandidaturasModule,
    HojeModule,
  ],
  controllers: [CopilotoController],
  providers: [ChatService, CapacidadesService, ConversasService, ToolExecutor, TurnosService],
})
export class CopilotoModule {}
