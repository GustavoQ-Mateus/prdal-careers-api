require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-bytes-0123456789';
const CSRF = 'csrf-de-teste';

async function subirApp(t, { controllers = [], providers = [], imports = [], configurar, bodyParser = true, sessoes } = {}) {
  const { JwtStrategy } = require('../../dist/auth/jwt.strategy');
  const { SessoesService } = require('../../dist/auth/sessoes.service');
  const { PrismaService } = require('../../dist/prisma/prisma.service');
  const sessoesProvider = sessoes === false ? [] : [{ provide: SessoesService, useValue: sessoes ?? { familiaAtiva: async () => true } }];
  class ModuloTeste {}
  Module({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => ({ JWT_SECRET: SEGREDO }) }),
      PassportModule,
      ...imports,
    ],
    controllers,
    providers: [JwtStrategy, ...sessoesProvider, { provide: PrismaService, useValue: { usuario: { findUnique: async () => ({ consentimentoLlmEm: new Date() }) } } }, ...providers],
  })(ModuloTeste);
  const app = await NestFactory.create(ModuloTeste, { logger: false, bodyParser, abortOnError: false });
  if (configurar) configurar(app);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  return { app, url: (await app.getUrl()).replace('[::1]', '127.0.0.1') };
}

function tokenDe(usuarioId, sid = 'sessao-teste') {
  return new JwtService({ secret: SEGREDO }).sign({ sub: usuarioId, email: `${usuarioId}@teste.dev`, sid });
}

function autenticado(usuarioId) {
  return { Cookie: `prdal_access=${tokenDe(usuarioId)}; prdal_csrf=${CSRF}`, 'X-CSRF-Token': CSRF };
}

module.exports = { subirApp, tokenDe, autenticado, SEGREDO, CSRF };
