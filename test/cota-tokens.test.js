require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { HttpModule } = require('@nestjs/axios');
const { ValidationPipe } = require('@nestjs/common');
const { ThrottlerModule } = require('@nestjs/throttler');
const { subirApp, autenticado } = require('./helpers/app-teste');

const {
  CotaTokensService,
  CotaTokensEsgotada,
  MENSAGEM_COTA_ESGOTADA,
  segundosAteVirada,
} = require('../dist/cota/cota-tokens.service');

function prismaDeUso() {
  const linhas = new Map();
  const chave = ({ usuarioId, dia }) => `${usuarioId}|${dia.toISOString()}`;
  return {
    linhas,
    usoTokensDiario: {
      findUnique: async ({ where }) => linhas.get(chave(where.usuarioId_dia)) ?? null,
      upsert: async ({ where, create, update }) => {
        const k = chave(where.usuarioId_dia);
        const atual = linhas.get(k);
        if (!atual) {
          linhas.set(k, { ...create });
          return linhas.get(k);
        }
        for (const [campo, valor] of Object.entries(update)) atual[campo] += valor.increment;
        return atual;
      },
    },
  };
}

class CotaComRelogio extends CotaTokensService {
  constructor(prisma, inicio) {
    super(prisma);
    this.instante = new Date(inicio);
  }
  agora() {
    return this.instante;
  }
}

function comLimite(t, valor) {
  const anterior = process.env.COTA_TOKENS_DIA;
  if (valor === undefined) delete process.env.COTA_TOKENS_DIA;
  else process.env.COTA_TOKENS_DIA = String(valor);
  t.after(() => {
    if (anterior === undefined) delete process.env.COTA_TOKENS_DIA;
    else process.env.COTA_TOKENS_DIA = anterior;
  });
}

const USO = { entrada: 120, saida: 80, cacheLida: 2000, cacheEscrita: 300, chamadas: 2 };

function aiServiceFalso() {
  const servidor = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/copiloto/redigir-mensagem') {
      res.statusCode = 503;
      res.end(JSON.stringify({ detail: 'indisponivel', uso: { ...USO, chamadas: 1, entrada: 50, saida: 0, cacheLida: 0, cacheEscrita: 0 } }));
      return;
    }
    res.end(JSON.stringify({ markdown: '# x', analiseInicial: {}, analiseFinal: {}, degradacao: null, modelo: 'claude-sonnet-5', uso: USO }));
  });
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => resolve({ servidor, url: `http://127.0.0.1:${servidor.address().port}` }));
  });
}

test('a api soma o uso devolvido pelo ai-service, inclusive quando a chamada falha', async (t) => {
  comLimite(t, 1_000_000);
  const { servidor, url } = await aiServiceFalso();
  t.after(() => servidor.close());
  process.env.AI_SERVICE_URL = url;
  const { AiClient } = require('../dist/clients/ai.client');
  const prisma = prismaDeUso();
  const cota = new CotaComRelogio(prisma, '2026-10-04T12:00:00Z');
  const { NestFactory } = require('@nestjs/core');
  class Modulo {}
  require('@nestjs/common').Module({ imports: [HttpModule], providers: [AiClient, { provide: CotaTokensService, useValue: cota }] })(Modulo);
  const app = await NestFactory.createApplicationContext(Modulo, { logger: false });
  t.after(() => app.close());
  const ai = app.get(AiClient);

  await ai.generateCvPipeline({ perfilMestre: {}, vaga: {}, keywords: [], contexto: [] }, { usuarioId: 'u1' });
  await ai.generateCvPipeline({ perfilMestre: {}, vaga: {}, keywords: [], contexto: [] }, { usuarioId: 'u1' });
  await assert.rejects(ai.redigirMensagem({ vaga: {}, perfil: {}, contexto: '' }, { usuarioId: 'u1' }));
  await ai.generateCvPipeline({ perfilMestre: {}, vaga: {}, keywords: [], contexto: [] });

  const linha = prisma.linhas.get('u1|2026-10-04T00:00:00.000Z');
  assert.deepEqual(
    { entrada: linha.entrada, saida: linha.saida, cacheLida: linha.cacheLida, cacheEscrita: linha.cacheEscrita, chamadas: linha.chamadas },
    { entrada: 290, saida: 160, cacheLida: 4000, cacheEscrita: 600, chamadas: 5 },
  );
  assert.equal(await cota.consumido('u1'), 290 + 160 * 5 + 4000 * 0.1 + 600 * 1.25);
  assert.equal(prisma.linhas.size, 1);
});

test('consumo pesa cada tipo de token pelo custo relativo', async () => {
  const consumo = async (uso) => {
    const cota = new CotaComRelogio(prismaDeUso(), '2026-10-04T12:00:00Z');
    await cota.registrar('u1', { entrada: 0, saida: 0, cacheLida: 0, cacheEscrita: 0, chamadas: 1, ...uso });
    return cota.consumido('u1');
  };
  assert.equal(await consumo({ cacheLida: 10_000 }), 1_000);
  assert.equal(await consumo({ saida: 1_000 }), 5_000);
  assert.equal(await consumo({ entrada: 1_000 }), 1_000);
  assert.equal(await consumo({ cacheEscrita: 1_000 }), 1_250);
  assert.equal(await consumo({ cacheLida: 3 }), 1);
  const prisma = prismaDeUso();
  const cota = new CotaComRelogio(prisma, '2026-10-04T12:00:00Z');
  await cota.registrar('u1', { entrada: 7, saida: 3, cacheLida: 11, cacheEscrita: 13, chamadas: 1 });
  const linha = prisma.linhas.get('u1|2026-10-04T00:00:00.000Z');
  assert.deepEqual([linha.entrada, linha.saida, linha.cacheLida, linha.cacheEscrita], [7, 3, 11, 13]);
});

test('cota estourada bloqueia a chamada ao ai-service antes de enviar', async (t) => {
  comLimite(t, 1000);
  let chamadas = 0;
  const servidor = http.createServer((_req, res) => {
    chamadas += 1;
    res.end('{}');
  });
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => servidor.close());
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${servidor.address().port}`;
  const { AiClient } = require('../dist/clients/ai.client');
  const prisma = prismaDeUso();
  const cota = new CotaComRelogio(prisma, '2026-10-04T12:00:00Z');
  await cota.registrar('u1', { entrada: 900, saida: 100, cacheLida: 0, cacheEscrita: 0, chamadas: 1 });
  const { NestFactory } = require('@nestjs/core');
  class Modulo {}
  require('@nestjs/common').Module({ imports: [HttpModule], providers: [AiClient, { provide: CotaTokensService, useValue: cota }] })(Modulo);
  const app = await NestFactory.createApplicationContext(Modulo, { logger: false });
  t.after(() => app.close());

  await assert.rejects(app.get(AiClient).keywords('Vaga', { usuarioId: 'u1' }), (err) => err instanceof CotaTokensEsgotada);
  assert.equal(chamadas, 0);
});

async function subirCopiloto(t, cota, chat = {}) {
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { CotaTokensFiltro } = require('../dist/cota/cota-tokens.guard');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  let chamadasIa = 0;
  const capacidades = {
    keywordsPrevia: async () => {
      chamadasIa += 1;
      return { keywords: [] };
    },
  };
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [CopilotoController],
    providers: [
      { provide: ChatService, useValue: chat },
      { provide: CapacidadesService, useValue: capacidades },
      { provide: ConversasService, useValue: {} },
      { provide: CotaTokensService, useValue: cota },
    ],
    configurar: (app) => {
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      app.useGlobalFilters(new CotaTokensFiltro());
    },
  });
  return { url, chamadasIa: () => chamadasIa };
}

test('rota de IA responde 429 com Retry-After ate a virada do dia quando a cota estoura', async (t) => {
  comLimite(t, 1000);
  const cota = new CotaComRelogio(prismaDeUso(), '2026-10-04T23:59:30Z');
  await cota.registrar('u1', { entrada: 600, saida: 400, cacheLida: 0, cacheEscrita: 0, chamadas: 1 });
  const { url, chamadasIa } = await subirCopiloto(t, cota);
  const enviar = (usuario) =>
    fetch(`${url}/copiloto/keywords-previa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...autenticado(usuario) },
      body: JSON.stringify({ descricao: 'Vaga Python' }),
    });

  const bloqueada = await enviar('u1');
  assert.equal(bloqueada.status, 429);
  assert.equal(bloqueada.headers.get('retry-after'), '30');
  assert.equal((await bloqueada.json()).message, MENSAGEM_COTA_ESGOTADA);
  assert.equal(chamadasIa(), 0);
  assert.equal((await enviar('u2')).status, 201);
  assert.equal(chamadasIa(), 1);
});

test('cota zero desliga o limite', async (t) => {
  comLimite(t, 0);
  const cota = new CotaComRelogio(prismaDeUso(), '2026-10-04T12:00:00Z');
  await cota.registrar('u1', { entrada: 50_000_000, saida: 0, cacheLida: 0, cacheEscrita: 0, chamadas: 1 });
  await cota.verificar('u1');
});

test('sem COTA_TOKENS_DIA vale o padrao documentado', async (t) => {
  comLimite(t, undefined);
  const { limiteDiario, COTA_TOKENS_DIA_PADRAO } = require('../dist/cota/cota-tokens.service');
  assert.equal(limiteDiario(), COTA_TOKENS_DIA_PADRAO);
});

test('a virada do dia em UTC zera o consumo', async (t) => {
  comLimite(t, 1000);
  const prisma = prismaDeUso();
  const cota = new CotaComRelogio(prisma, '2026-10-04T23:59:59Z');
  await cota.registrar('u1', { entrada: 1000, saida: 0, cacheLida: 0, cacheEscrita: 0, chamadas: 1 });
  await assert.rejects(cota.verificar('u1'), (err) => err instanceof CotaTokensEsgotada && err.retryAfterSegundos === 1);

  cota.instante = new Date('2026-10-05T00:00:00Z');
  assert.equal(await cota.consumido('u1'), 0);
  await cota.verificar('u1');
  assert.equal(segundosAteVirada(new Date('2026-10-05T00:00:00Z')), 86400);
});

test('no chat SSE a cota estourada sai como evento de erro', async (t) => {
  comLimite(t, 1000);
  const { ChatService } = require('../dist/copiloto/chat.service');
  const eventos = [];
  const conversa = { _id: 'c1', usuarioId: 'u1', modo: 'assistido', oportunidadeId: null, mensagens: [], pendencia: null };
  const conversas = {
    abrir: async () => conversa,
    adicionarMensagem: async () => {},
    registrarMensagem: async () => {},
    definirPendencia: async () => {},
    finalizar: async () => {},
  };
  const ai = {
    copilotoTurn: async () => {
      throw new CotaTokensEsgotada(120);
    },
  };
  const chat = new ChatService(conversas, ai, {}, { garantirVaga: async () => {} });
  chat.registrar = async () => {};
  chat.registrarErro = async () => {};
  const res = {
    setHeader: () => {},
    flushHeaders: () => {},
    write: (bloco) => eventos.push(bloco),
    end: () => {},
  };
  await chat.chat(res, { userId: 'u1' }, {}, { mensagem: 'oi' });

  const erro = eventos.find((bloco) => bloco.includes('event: erro'));
  assert.ok(erro, eventos.join(''));
  assert.match(erro, /"escopo":"cota"/);
  assert.ok(erro.includes(MENSAGEM_COTA_ESGOTADA));
  assert.match(erro, /"retryAfter":120/);
});

test('as rotas que sempre chamam o Claude exigem a cota e o filtro e global', () => {
  const { GUARDS_METADATA } = require('@nestjs/common/constants');
  const { CotaTokensGuard } = require('../dist/cota/cota-tokens.guard');
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { OportunidadesController } = require('../dist/oportunidades/oportunidades.controller');
  const { VagasController } = require('../dist/vagas/vagas.controller');
  const { BancoVagasController } = require('../dist/banco-vagas/banco-vagas.controller');
  const { CotaModule } = require('../dist/cota/cota.module');
  const { APP_FILTER } = require('@nestjs/core');
  const rotas = [
    [CopilotoController, ['keywordsPrevia', 'mensagemRecrutador', 'respostasFormulario']],
    [OportunidadesController, ['criar', 'reprocessarKeywords', 'importar', 'gerarCv']],
    [VagasController, ['criar', 'gerarCv']],
    [BancoVagasController, ['importar']],
  ];
  for (const [controller, metodos] of rotas) {
    for (const metodo of metodos) {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.prototype[metodo]) ?? [];
      assert.ok(guards.includes(CotaTokensGuard), `${controller.name}.${metodo}`);
    }
  }
  const providers = Reflect.getMetadata('providers', CotaModule);
  assert.ok(providers.some((p) => p.provide === APP_FILTER));
});
