require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { Controller, Get, Module, UseGuards } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { validarAmbiente } = require('../dist/config/ambiente');
const { JwtStrategy } = require('../dist/auth/jwt.strategy');
const { JwtAuthGuard } = require('../dist/auth/jwt-auth.guard');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-bytes-0123456789';
const SERVICE_TOKEN = 'token-de-servico-de-teste-com-mais-de-32-bytes';

test('fora de development a api nao sobe sem JWT_SECRET', () => {
  assert.throws(() => validarAmbiente({ NODE_ENV: 'production', SERVICE_TOKEN }), /JWT_SECRET/);
  assert.throws(() => validarAmbiente({ SERVICE_TOKEN }), /JWT_SECRET/);
  assert.throws(() => validarAmbiente({ NODE_ENV: 'production', SERVICE_TOKEN, JWT_SECRET: 'dev-secret' }), /32 bytes/);
  assert.equal(validarAmbiente({ NODE_ENV: 'production', SERVICE_TOKEN, JWT_SECRET: SEGREDO }).JWT_SECRET, SEGREDO);
});

test('fora de development a api nao sobe sem SERVICE_TOKEN', () => {
  assert.throws(() => validarAmbiente({ NODE_ENV: 'production', JWT_SECRET: SEGREDO }), /SERVICE_TOKEN/);
  assert.throws(() => validarAmbiente({ NODE_ENV: 'production', JWT_SECRET: SEGREDO, SERVICE_TOKEN: 'curto' }), /SERVICE_TOKEN/);
  assert.equal(validarAmbiente({ NODE_ENV: 'development' }).SERVICE_TOKEN, undefined);
});

test('em development sem segredo usa um segredo aleatorio, nunca dev-secret', () => {
  const primeiro = validarAmbiente({ NODE_ENV: 'development' }).JWT_SECRET;
  const segundo = validarAmbiente({ NODE_ENV: 'development', JWT_SECRET: 'dev-secret' }).JWT_SECRET;
  assert.notEqual(primeiro, 'dev-secret');
  assert.notEqual(segundo, 'dev-secret');
  assert.notEqual(primeiro, segundo);
  assert.ok(Buffer.byteLength(primeiro) >= 32);
});

test('token assinado com dev-secret retorna 401 quando o segredo configurado e outro', async (t) => {
  class Protegido {
    ler() {
      return { ok: true };
    }
  }
  Get('protegido')(Protegido.prototype, 'ler', Object.getOwnPropertyDescriptor(Protegido.prototype, 'ler'));
  UseGuards(JwtAuthGuard)(Protegido);
  Controller()(Protegido);

  class ModuloTeste {}
  Module({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => validarAmbiente({ NODE_ENV: 'production', JWT_SECRET: SEGREDO, SERVICE_TOKEN }) }),
      PassportModule,
    ],
    controllers: [Protegido],
    providers: [JwtStrategy],
  })(ModuloTeste);

  const app = await NestFactory.create(ModuloTeste, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const url = `${await app.getUrl()}/protegido`.replace('[::1]', '127.0.0.1');
  const payload = { sub: 'usuario-vitima', email: 'vitima@example.com' };

  const forjado = new JwtService({ secret: 'dev-secret' }).sign(payload);
  const negado = await fetch(url, { headers: { Authorization: `Bearer ${forjado}` } });
  assert.equal(negado.status, 401);

  const valido = new JwtService({ secret: SEGREDO }).sign(payload);
  const aceito = await fetch(url, { headers: { Authorization: `Bearer ${valido}` } });
  assert.equal(aceito.status, 200);
});
