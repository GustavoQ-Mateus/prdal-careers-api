import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarCabecalhos } from './config/cabecalhos';
import { configurarCorpo } from './config/corpo';
import { opcoesCors } from './config/cors';
import { configurarCsrf } from './config/csrf';
import { configurarPrefixo } from './config/prefixo';
import { configurarProxy } from './config/proxy';
import { configurarServidor, temposServidor } from './config/servidor';
import { desligar } from './observabilidade/desligamento';
import { FiltroErros } from './observabilidade/erros';
import { LoggerJson } from './observabilidade/logger';
import { configurarContexto, configurarRequisicoes } from './observabilidade/requisicao';

async function bootstrap() {
  const logger = new LoggerJson();
  temposServidor();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger });
  configurarRequisicoes(app, logger);
  configurarProxy(app);
  configurarPrefixo(app);
  configurarCabecalhos(app);
  app.enableCors(opcoesCors());
  configurarCorpo(app);
  configurarCsrf(app);
  configurarContexto(app);
  app.useGlobalFilters(new FiltroErros());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  configurarServidor(app.getHttpServer());
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sinal, () => {
      logger.log({ mensagem: 'sinal recebido', sinal }, 'Desligamento');
      void desligar(app, logger).finally(() => process.exit(0));
    });
  }
}

bootstrap();
