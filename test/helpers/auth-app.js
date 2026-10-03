require('reflect-metadata');
const { Controller, Get, Post, UseGuards, ValidationPipe } = require('@nestjs/common');
const { JwtModule } = require('@nestjs/jwt');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, SEGREDO } = require('./app-teste');
const { prismaMemoria } = require('./prisma-memoria');

function controllerProtegido() {
  const { JwtAuthGuard } = require('../../dist/auth/jwt-auth.guard');
  class Protegido {
    ler() {
      return { ok: true };
    }
    escrever() {
      return { gravado: true };
    }
  }
  Get('ler')(Protegido.prototype, 'ler', Object.getOwnPropertyDescriptor(Protegido.prototype, 'ler'));
  Post('escrever')(Protegido.prototype, 'escrever', Object.getOwnPropertyDescriptor(Protegido.prototype, 'escrever'));
  UseGuards(JwtAuthGuard)(Protegido);
  Controller('protegido')(Protegido);
  return Protegido;
}

async function subirAuth(t, { usuarios = [] } = {}) {
  const { AuthController } = require('../../dist/auth/auth.controller');
  const { AuthService } = require('../../dist/auth/auth.service');
  const { SessoesService } = require('../../dist/auth/sessoes.service');
  const { PrismaService } = require('../../dist/prisma/prisma.service');
  const { JANELAS } = require('../../dist/limites/limite-requisicoes');
  const { configurarCsrf } = require('../../dist/config/csrf');
  const prisma = prismaMemoria({ usuarios });
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS), JwtModule.register({ secret: SEGREDO, signOptions: { expiresIn: '15m' } })],
    controllers: [AuthController, controllerProtegido()],
    providers: [AuthService, SessoesService, { provide: PrismaService, useValue: prisma }],
    sessoes: false,
    configurar: (app) => {
      configurarCsrf(app);
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    },
  });
  return { url, prisma, navegador: () => navegador(url) };
}

function navegador(url) {
  const jarra = new Map();
  const respostas = [];

  function guardar(res) {
    for (const linha of res.headers.getSetCookie()) {
      const [par, ...atributos] = linha.split(';').map((p) => p.trim());
      const igual = par.indexOf('=');
      const nome = par.slice(0, igual);
      const valor = par.slice(igual + 1);
      const attrs = Object.fromEntries(atributos.map((a) => {
        const i = a.indexOf('=');
        return i < 0 ? [a.toLowerCase(), true] : [a.slice(0, i).toLowerCase(), a.slice(i + 1)];
      }));
      const expirado = attrs['max-age'] === '0' || (attrs.expires && new Date(attrs.expires) <= new Date());
      if (expirado || valor === '') jarra.delete(nome);
      else jarra.set(nome, { valor, path: attrs.path ?? '/', linha, attrs });
    }
  }

  function cookiesPara(caminho) {
    return [...jarra.entries()]
      .filter(([, c]) => caminho.startsWith(c.path))
      .map(([n, c]) => `${n}=${c.valor}`)
      .join('; ');
  }

  async function chamar(caminho, { metodo = 'GET', corpo, csrf = true, cabecalhos = {} } = {}) {
    const headers = { ...cabecalhos };
    const cookie = cookiesPara(caminho);
    if (cookie) headers.Cookie = cookie;
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf && metodo !== 'GET' && jarra.get('prdal_csrf')) headers['X-CSRF-Token'] = jarra.get('prdal_csrf').valor;
    const res = await fetch(url + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    guardar(res);
    respostas.push(res);
    return res;
  }

  return {
    jarra,
    chamar,
    entrar: (email, senha) => chamar('/auth/login', { metodo: 'POST', corpo: { email, senha } }),
    clonar() {
      const outro = navegador(url);
      for (const [n, c] of jarra) outro.jarra.set(n, { ...c });
      return outro;
    },
  };
}

module.exports = { subirAuth };
