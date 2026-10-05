import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validarAmbiente } from './config/ambiente';
import { cabecalhoServico } from './config/servico';
import { BancoVagasModule } from './banco-vagas/banco-vagas.module';
import { CandidaturasModule } from './candidaturas/candidaturas.module';
import { ContextoModule } from './contexto/contexto.module';
import { CopilotoModule } from './copiloto/copiloto.module';
import { CotaModule } from './cota/cota.module';
import { CurriculosModule } from './curriculos/curriculos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LotesModule } from './lotes/lotes.module';
import { PerfilModule } from './perfil/perfil.module';
import { EventosModule } from './eventos/eventos.module';
import { HojeModule } from './hoje/hoje.module';
import { JANELAS } from './limites/limite-requisicoes';
import { JobsModule } from './jobs/jobs.module';
import { OportunidadesModule } from './oportunidades/oportunidades.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { PipelineAtsModule } from './pipeline-ats/pipeline-ats.module';
import { PrismaModule } from './prisma/prisma.module';
import { RepositoriosModule } from './repositorios/repositorios.module';
import { SaudeModule } from './saude/saude.module';
import { TaxonomiaModule } from './taxonomia/taxonomia.module';
import { VagasModule } from './vagas/vagas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validarAmbiente }),
    HttpModule.registerAsync({
      useFactory: () => ({ timeout: 5000, headers: cabecalhoServico() }),
    }),
    ThrottlerModule.forRoot(JANELAS),
    PrismaModule,
    JobsModule,
    PipelineAtsModule,
    CotaModule,
    RepositoriosModule,
    AuthModule,
    PerfilModule,
    EventosModule,
    VagasModule,
    CurriculosModule,
    DashboardModule,
    LotesModule,
    BancoVagasModule,
    CandidaturasModule,
    ContextoModule,
    OportunidadesModule,
    HojeModule,
    PipelineModule,
    CopilotoModule,
    TaxonomiaModule,
    SaudeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
