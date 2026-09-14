import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BancoVagasModule } from './banco-vagas/banco-vagas.module';
import { CandidaturasModule } from './candidaturas/candidaturas.module';
import { ContextoModule } from './contexto/contexto.module';
import { CurriculosModule } from './curriculos/curriculos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LotesModule } from './lotes/lotes.module';
import { MongoModule } from './mongo/mongo.module';
import { PerfilModule } from './perfil/perfil.module';
import { PrismaModule } from './prisma/prisma.module';
import { VagasModule } from './vagas/vagas.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 5000 }),
    PrismaModule,
    MongoModule,
    AuthModule,
    PerfilModule,
    VagasModule,
    CurriculosModule,
    DashboardModule,
    LotesModule,
    BancoVagasModule,
    CandidaturasModule,
    ContextoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
