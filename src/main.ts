import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarCabecalhos } from './config/cabecalhos';
import { configurarCorpo } from './config/corpo';
import { opcoesCors } from './config/cors';
import { configurarCsrf } from './config/csrf';
import { configurarProxy } from './config/proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configurarProxy(app);
  configurarCabecalhos(app);
  app.enableCors(opcoesCors());
  configurarCorpo(app);
  configurarCsrf(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

bootstrap();
