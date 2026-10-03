require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { ValidationPipe } = require('@nestjs/common');
const { JwtModule } = require('@nestjs/jwt');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, SEGREDO } = require('./helpers/app-teste');

function prismaFalso(usuarios) {
  return {
    usuario: {
      findFirst: async ({ where }) =>
        usuarios.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()) ?? null,
      create: async ({ data }) => {
        const usuario = { id: `u-${usuarios.length + 1}`, criadoEm: new Date(), ...data };
        usuarios.push(usuario);
        return usuario;
      },
    },
  };
}

async function subir(t, usuarios) {
  const { AuthController } = require('../dist/auth/auth.controller');
  const { AuthService } = require('../dist/auth/auth.service');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS), JwtModule.register({ secret: SEGREDO })],
    controllers: [AuthController],
    providers: [AuthService, { provide: PrismaService, useValue: prismaFalso(usuarios) }],
    configurar: (app) => app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })),
  });
  const post = (rota, email, senha) =>
    fetch(`${url}/auth/${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
  return post;
}

test('cadastro exige senha com pelo menos 10 caracteres', async (t) => {
  const usuarios = [];
  const post = await subir(t, usuarios);
  for (const senha of ['123456', '123456789']) {
    const r = await post('register', `curta${senha.length}@teste.dev`, senha);
    assert.equal(r.status, 400);
    assert.match(JSON.stringify(await r.json()), /pelo menos 10 caracteres/);
  }
  assert.equal((await post('register', 'longa@teste.dev', '1234567890')).status, 201);
  assert.equal(usuarios.length, 1);
});

test('cadastro com email existente responde igual a um cadastro novo', async (t) => {
  const usuarios = [{ id: 'vitima', email: 'vitima@teste.dev', senhaHash: await bcrypt.hash('senha-original-123', 4), criadoEm: new Date() }];
  const post = await subir(t, usuarios);

  const novo = await post('register', 'nova@teste.dev', 'senha-nova-1234');
  const existente = await post('register', 'VITIMA@teste.dev', 'senha-do-atacante');
  assert.equal(existente.status, novo.status);
  assert.deepEqual(await existente.json(), await novo.json());
  assert.deepEqual(usuarios.map((u) => u.email), ['vitima@teste.dev', 'nova@teste.dev']);

  assert.equal((await post('login', 'vitima@teste.dev', 'senha-do-atacante')).status, 401);
  assert.equal((await post('login', 'vitima@teste.dev', 'senha-original-123')).status, 201);
});

test('conta existente com senha curta continua entrando, sem diferenca de caixa no email', async (t) => {
  const usuarios = [{ id: 'antiga', email: 'antiga@teste.dev', senhaHash: await bcrypt.hash('123456', 4), criadoEm: new Date() }];
  const post = await subir(t, usuarios);
  const r = await post('login', ' Antiga@Teste.dev ', '123456');
  assert.equal(r.status, 201);
  assert.ok((await r.json()).accessToken);
  assert.equal((await post('login', 'nao-existe@teste.dev', '123456')).status, 401);
});
