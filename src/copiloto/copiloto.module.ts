import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { PerfilModule } from '../perfil/perfil.module';
import { CapacidadesService } from './capacidades.service';
import { ChatService } from './chat.service';
import { ConversasService } from './conversas.service';
import { CopilotoController } from './copiloto.controller';

@Module({
  imports: [
    HttpModule.register({ timeout: 60000 }),
    ClientsModule,
    OportunidadesModule,
    PerfilModule,
  ],
  controllers: [CopilotoController],
  providers: [ChatService, CapacidadesService, ConversasService],
})
export class CopilotoModule {}
