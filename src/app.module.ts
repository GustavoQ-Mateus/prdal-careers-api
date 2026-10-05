import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ArquivosModule } from './arquivos/arquivos.module';
import { AuthModule } from './auth/auth.module';
import { validarAmbiente } from './config/ambiente';
import { cabecalhoServico } from './config/servico';
import { CandidaturasModule } from './candidaturas/candidaturas.module';
import { ContextoModule } from './contexto/contexto.module';
import { CopilotoModule } from './copiloto/copiloto.module';
import { ContaModule } from './conta/conta.module';
import { CotaModule } from './cota/cota.module';
import { CurriculosModule } from './curriculos/curriculos.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validarAmbiente }),
    HttpModule.registerAsync({
      useFactory: () => ({ timeout: 5000, headers: cabecalhoServico() }),
    }),
    ThrottlerModule.forRoot(JANELAS),
    PrismaModule,
    JobsModule,
    ArquivosModule,
    PipelineAtsModule,
    CotaModule,
    RepositoriosModule,
    AuthModule,
    ContaModule,
    PerfilModule,
    EventosModule,
    CurriculosModule,
    LotesModule,
    CandidaturasModule,
    ContextoModule,
    OportunidadesModule,
    HojeModule,
    PipelineModule,
    CopilotoModule,
    TaxonomiaModule,
    SaudeModule,
  ],
})
export class AppModule {}
