require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const axios = require('axios');
const { HttpService } = require('@nestjs/axios');
const {
  Body,
  ConflictException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  ValidationPipe,
} = require('@nestjs/common');
const { ThrottlerException, ThrottlerModule } = require('@nestjs/throttler');
const { IsString } = require('class-validator');
const { subirApp, autenticado } = require('./helpers/app-teste');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function logsCapturados() {
  const linhas = [];
  const { LoggerJson } = require('../dist/observabilidade/logger');
  const logger = new LoggerJson('api', (linha) => linhas.push(JSON.parse(linha)));
  return { logger, linhas };
}

function servidorAi(t) {
  const recebidos = [];
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      recebidos.push({ url: req.url, requestId: req.headers['x-request-id'] });
      req.resume();
      req.on('end', () => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ score: 70 })));
    });
    srv.listen(0, '127.0.0.1', () => {
      t.after(() => srv.close());
      resolver({ url: `http://127.0.0.1:${srv.address().port}`, recebidos });
    });
  });
}

class CorpoDto {}
IsString()(CorpoDto.prototype, 'nome');

async function subirComObservabilidade(t, { logger, aiUrl } = {}) {
  const { FiltroErros } = require('../dist/observabilidade/erros');
  const { configurarContexto, configurarRequisicoes } = require('../dist/observabilidade/requisicao');
  const { propagarRequestId } = require('../dist/observabilidade/propagacao');
  const { configurarCorpo } = require('../dist/config/corpo');
  process.env.AI_SERVICE_URL = aiUrl ?? 'http://127.0.0.1:9';
  const { AiClient } = require('../dist/clients/ai.client');
  const httpService = new HttpService(axios.create());
  propagarRequestId(httpService);
  const ai = new AiClient(httpService, { verificar: async () => {}, registrar: async () => {} });
  const log = new Logger('Rotas');

  class Rotas {
    sumida() {
      throw new NotFoundException('vaga nao encontrada');
    }
    ocupada() {
      throw new ConflictException({ message: 'turno em curso', codigo: 'turno_em_andamento' });
    }
    quebrada() {
      throw new Error('segredo interno: senha=123');
    }
    limite() {
      throw new ThrottlerException('muitas requisicoes');
    }
    validar(corpo) {
      return corpo;
    }
    async pontuar() {
      log.log('pontuando curriculo');
      return ai.score('# curriculo', { keywords: [] });
    }
  }
  const descritor = (nome) => Object.getOwnPropertyDescriptor(Rotas.prototype, nome);
  Get('sumida')(Rotas.prototype, 'sumida', descritor('sumida'));
  Get('ocupada')(Rotas.prototype, 'ocupada', descritor('ocupada'));
  Get('quebrada')(Rotas.prototype, 'quebrada', descritor('quebrada'));
  Get('limite')(Rotas.prototype, 'limite', descritor('limite'));
  Post('validar')(Rotas.prototype, 'validar', descritor('validar'));
  Body()(Rotas.prototype, 'validar', 0);
  Reflect.defineMetadata('design:paramtypes', [CorpoDto], Rotas.prototype, 'validar');
  Get('pontuar')(Rotas.prototype, 'pontuar', descritor('pontuar'));
  Controller('teste')(Rotas);

  const { app, url } = await subirApp(t, {
    controllers: [Rotas],
    configurar: (aplicacao) => {
      if (logger) aplicacao.useLogger(logger);
      configurarRequisicoes(aplicacao, logger ?? new Logger());
      configurarCorpo(aplicacao);
      configurarContexto(aplicacao);
      aplicacao.useGlobalFilters(new FiltroErros());
      aplicacao.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    },
    bodyParser: false,
  });
  return { app, url };
}

test('erro sai no formato unico com codigo estavel e o requestId do cabecalho', async (t) => {
  const { url } = await subirComObservabilidade(t);
  const casos = [
    ['/teste/sumida', 404, 'nao_encontrado', 'vaga nao encontrada'],
    ['/teste/ocupada', 409, 'turno_em_andamento', 'turno em curso'],
    ['/teste/limite', 429, 'limite_de_requisicoes', 'muitas requisicoes'],
    ['/nao-existe', 404, 'nao_encontrado', 'Cannot GET /nao-existe'],
  ];
  for (const [rota, status, codigo, mensagem] of casos) {
    const resposta = await fetch(`${url}${rota}`);
    const corpo = await resposta.json();
    assert.equal(resposta.status, status, rota);
    assert.deepEqual(Object.keys(corpo), ['erro'], rota);
    assert.equal(corpo.erro.codigo, codigo, rota);
    assert.equal(corpo.erro.mensagem, mensagem, rota);
    assert.match(corpo.erro.requestId, UUID, rota);
    assert.equal(resposta.headers.get('x-request-id'), corpo.erro.requestId, rota);
  }
});

test('validacao vira dados_invalidos e corpo grande vira corpo_grande_demais', async (t) => {
  const { url } = await subirComObservabilidade(t);
  const invalido = await fetch(`${url}/teste/validar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 7 }) });
  const corpo = await invalido.json();
  assert.equal(invalido.status, 400);
  assert.equal(corpo.erro.codigo, 'dados_invalidos');
  assert.match(corpo.erro.mensagem, /nome must be a string/);
  const grande = await fetch(`${url}/teste/validar`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-grande' }, body: JSON.stringify({ nome: 'a'.repeat(2 * 1024 * 1024) }) });
  assert.equal(grande.status, 413);
  assert.deepEqual(await grande.json(), { erro: { codigo: 'corpo_grande_demais', mensagem: 'corpo da requisicao acima do limite de 1mb', requestId: 'req-grande' } });
});

test('erro inesperado responde 500 sem vazar detalhe e o log guarda causa e requestId', async (t) => {
  const { logger, linhas } = logsCapturados();
  const { url } = await subirComObservabilidade(t, { logger });
  const resposta = await fetch(`${url}/teste/quebrada`, { headers: { 'X-Request-Id': 'req-quebrada' } });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 500);
  assert.deepEqual(corpo, { erro: { codigo: 'erro_interno', mensagem: 'Erro interno. Informe o requestId se precisar de ajuda.', requestId: 'req-quebrada' } });
  assert.doesNotMatch(JSON.stringify(corpo), /segredo/);
  const erro = linhas.find((l) => l.nivel === 'error' && l.contexto === 'Erros');
  assert.equal(erro.requestId, 'req-quebrada');
  assert.equal(erro.mensagem, 'segredo interno: senha=123');
  assert.match(erro.stack, /quebrada/);
});

test('requestId de ponta a ponta: entra, chega ao ai-service, volta no cabecalho e esta em todo log', async (t) => {
  const { logger, linhas } = logsCapturados();
  const ai = await servidorAi(t);
  const { url } = await subirComObservabilidade(t, { logger, aiUrl: ai.url });

  const recebido = await fetch(`${url}/teste/pontuar`, { headers: { 'X-Request-Id': 'req-web-123' } });
  assert.equal(recebido.status, 200);
  assert.equal(recebido.headers.get('x-request-id'), 'req-web-123');
  assert.deepEqual(ai.recebidos.at(-1), { url: '/score', requestId: 'req-web-123' });

  const gerado = await fetch(`${url}/teste/pontuar`, { headers: { 'X-Request-Id': 'invalido com espaco' } });
  const novoId = gerado.headers.get('x-request-id');
  assert.match(novoId, UUID);
  assert.equal(ai.recebidos.at(-1).requestId, novoId);

  await new Promise((r) => setTimeout(r, 20));
  const doHandler = linhas.filter((l) => l.mensagem === 'pontuando curriculo').map((l) => l.requestId);
  assert.deepEqual(doHandler, ['req-web-123', novoId]);
  const acesso = linhas.find((l) => l.mensagem === 'requisicao' && l.requestId === 'req-web-123');
  assert.equal(acesso.metodo, 'GET');
  assert.equal(acesso.rota, '/teste/pontuar');
  assert.equal(acesso.status, 200);
  assert.equal(typeof acesso.duracaoMs, 'number');
  for (const linha of linhas) {
    assert.ok(linha.horario && linha.nivel && linha.servico === 'api', JSON.stringify(linha));
  }
});

test('logger escreve uma linha JSON por evento com contexto e stack', () => {
  const { logger, linhas } = logsCapturados();
  logger.log('subiu', 'Boot');
  logger.warn({ mensagem: 'lento', duracaoMs: 900 }, 'Http');
  logger.error('falhou', 'Error: x\n    at f (a.js:1:1)', 'Servico');
  logger.debug('detalhe', 'Boot');
  assert.equal(linhas.length, 3);
  assert.deepEqual(Object.keys(linhas[0]), ['horario', 'nivel', 'servico', 'contexto', 'mensagem']);
  assert.equal(linhas[1].duracaoMs, 900);
  assert.equal(linhas[2].contexto, 'Servico');
  assert.match(linhas[2].stack, /at f/);
});

function conversas() {
  const conversa = { _id: 'c-desligar', usuarioId: 'u1', modo: 'assistido', oportunidadeId: null, mensagens: [], pendencia: null };
  return {
    conversa,
    abrir: async () => conversa,
    anexar: async (_id, mensagem) => conversa.mensagens.push(mensagem),
    definirPendencia: async () => {},
    definirResumo: async () => {},
  };
}

async function subirCopiloto(t, logger) {
  const { CopilotoController } = require('../dist/copiloto/copiloto.controller');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const { CapacidadesService } = require('../dist/copiloto/capacidades.service');
  const { ConversasService } = require('../dist/copiloto/conversas.service');
  const { TurnosService } = require('../dist/copiloto/turnos.service');
  const { TurnoCancelado } = require('../dist/clients/ai.client');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const { configurarContexto, configurarRequisicoes } = require('../dist/observabilidade/requisicao');
  const { turnosEmMemoria } = require('./helpers/turnos');
  const repositorio = conversas();
  const turnos = turnosEmMemoria();
  const ai = {
    copilotoTurnStream: (_payload, _op, _delta, sinal) =>
      new Promise((_, rejeitar) => sinal.addEventListener('abort', () => rejeitar(new TurnoCancelado()))),
  };
  const chat = new ChatService(repositorio, ai, {}, { garantirVaga: async () => {} });
  const { app, url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [CopilotoController],
    providers: [
      { provide: ChatService, useValue: chat },
      { provide: CapacidadesService, useValue: {} },
      { provide: ConversasService, useValue: repositorio },
      { provide: TurnosService, useValue: turnos },
      { provide: require('../dist/cota/cota-tokens.service').CotaTokensService, useValue: { verificar: async () => {} } },
    ],
    configurar: (aplicacao) => {
      configurarRequisicoes(aplicacao, logger);
      configurarContexto(aplicacao);
      aplicacao.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    },
  });
  return { app, url, repositorio, turnos };
}

test('SIGTERM com turno aberto: evento de erro recuperavel, trava liberada e servidor fechado', async (t) => {
  const { reiniciarEstadoDesligamento, desligar, acompanharTrabalho } = require('../dist/observabilidade/desligamento');
  reiniciarEstadoDesligamento();
  t.after(reiniciarEstadoDesligamento);
  const { logger, linhas } = logsCapturados();
  const { app, url, repositorio, turnos } = await subirCopiloto(t, logger);

  const resposta = await fetch(`${url}/copiloto/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...autenticado('u1') },
    body: JSON.stringify({ mensagem: 'oi' }),
  });
  assert.equal(resposta.status, 201);
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let texto = decodificador.decode((await leitor.read()).value);
  assert.match(texto, /event: conversa/);
  assert.equal(turnos.travas.size, 1);

  let concluida = false;
  void acompanharTrabalho(new Promise((r) => setTimeout(r, 150)).then(() => { concluida = true; }));

  const resultado = await desligar(app, logger, 3000);
  for (;;) {
    const parte = await leitor.read();
    if (parte.done) break;
    texto += decodificador.decode(parte.value);
  }
  assert.deepEqual(resultado, { limpo: true });
  assert.equal(concluida, true);
  const erro = JSON.parse(texto.split('event: erro\ndata: ')[1].split('\n')[0]);
  assert.equal(erro.escopo, 'servidor');
  assert.equal(erro.recuperavel, true);
  assert.match(erro.mensagem, /servidor está reiniciando/);
  assert.match(texto, /event: fim_turno\ndata: \{"motivo":"erro","conversaId":"c-desligar"\}/);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(turnos.travas.size, 0);
  assert.equal(repositorio.conversa.mensagens.at(-1).dados.evento, 'cancelado');
  await assert.rejects(fetch(`${url}/copiloto/conversas`, { headers: autenticado('u1') }));
  assert.ok(linhas.some((l) => l.mensagem === 'desligamento iniciado' && l.turnos === 1));
  assert.ok(linhas.some((l) => l.mensagem === 'desligamento concluido' && l.limpo === true));
});

test('prazo de desligamento esgotado registra o que ficou pendente', async (t) => {
  const { reiniciarEstadoDesligamento, desligar, acompanharTrabalho } = require('../dist/observabilidade/desligamento');
  reiniciarEstadoDesligamento();
  t.after(reiniciarEstadoDesligamento);
  const { logger, linhas } = logsCapturados();
  const { app } = await subirCopiloto(t, logger);
  void acompanharTrabalho(new Promise(() => {}));
  const inicio = Date.now();
  const resultado = await desligar(app, logger, 200);
  assert.deepEqual(resultado, { limpo: false });
  assert.ok(Date.now() - inicio < 1500);
  const aviso = linhas.find((l) => l.nivel === 'warn' && /prazo de desligamento esgotado/.test(l.mensagem));
  assert.equal(aviso.trabalhos, 1);
});

test('durante o desligamento requisicao nova recebe 503 com Connection close', async (t) => {
  const { reiniciarEstadoDesligamento, desligar } = require('../dist/observabilidade/desligamento');
  const { middlewareRequisicao } = require('../dist/observabilidade/requisicao');
  reiniciarEstadoDesligamento();
  t.after(reiniciarEstadoDesligamento);
  const { logger } = logsCapturados();
  const appFalso = { getHttpServer: () => http.createServer(), close: async () => {} };
  await desligar(appFalso, logger, 10);
  const cabecalhos = {};
  let status;
  let corpo;
  let seguiu = false;
  const res = {
    statusCode: 200,
    setHeader: (nome, valor) => { cabecalhos[nome.toLowerCase()] = valor; },
    getHeader: (nome) => cabecalhos[nome.toLowerCase()],
    on() {},
    status(codigo) { status = codigo; return this; },
    json(dados) { corpo = dados; },
  };
  middlewareRequisicao(logger)({ headers: { 'x-request-id': 'req-tarde' }, originalUrl: '/vagas', method: 'GET' }, res, () => { seguiu = true; });
  assert.equal(seguiu, false);
  assert.equal(status, 503);
  assert.equal(cabecalhos.connection, 'close');
  assert.deepEqual(corpo, { erro: { codigo: 'servico_indisponivel', mensagem: 'O servidor está reiniciando. Tente de novo em instantes.', requestId: 'req-tarde' } });
});
