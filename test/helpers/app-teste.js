require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-bytes-0123456789';

async function subirApp(t, { controllers = [], providers = [], imports = [], configurar, bodyParser = true } = {}) {
  const { JwtStrategy } = require('../../dist/auth/jwt.strategy');
  class ModuloTeste {}
  Module({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => ({ JWT_SECRET: SEGREDO }) }),
      PassportModule,
      ...imports,
    ],
    controllers,
    providers: [JwtStrategy, ...providers],
  })(ModuloTeste);
  const app = await NestFactory.create(ModuloTeste, { logger: false, bodyParser });
  if (configurar) configurar(app);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  return { app, url: (await app.getUrl()).replace('[::1]', '127.0.0.1') };
}

function tokenDe(usuarioId) {
  return new JwtService({ secret: SEGREDO }).sign({ sub: usuarioId, email: `${usuarioId}@teste.dev` });
}

module.exports = { subirApp, tokenDe, SEGREDO };
