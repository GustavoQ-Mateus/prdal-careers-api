import { Module } from '@nestjs/common';
import { CandidaturasModule } from '../candidaturas/candidaturas.module';
import { ClientsModule } from '../clients/clients.module';
import { CurriculosModule } from '../curriculos/curriculos.module';
import { HojeModule } from '../hoje/hoje.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { PerfilModule } from '../perfil/perfil.module';
import { RagModule } from '../rag/rag.module';
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
    CandidaturasModule,
    HojeModule,
    RagModule,
  ],
  controllers: [CopilotoController],
  providers: [ChatService, CapacidadesService, ConversasService, ToolExecutor, TurnosService],
})
export class CopilotoModule {}
