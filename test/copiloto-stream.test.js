const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const axios = require('axios');
const { HttpService } = require('@nestjs/axios');

function servidor(t, roteiro) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/x-ndjson');
        roteiro(res, req).catch(() => res.destroy());
      });
    });
    srv.listen(0, '127.0.0.1', () => {
      t.after(() => srv.close());
      resolve(`http://127.0.0.1:${srv.address().port}`);
    });
  });
}

const linha = (dados) => `${JSON.stringify(dados)}\n`;
const usoFinal = { entrada: 10, saida: 5, cacheLida: 900, cacheEscrita: 0, chamadas: 1 };

function montar(url) {
  process.env.AI_SERVICE_URL = url;
  const { AiClient } = require('../dist/clients/ai.client');
  const { ChatService } = require('../dist/copiloto/chat.service');
  const usos = [];
  const cota = { verificar: async () => {}, registrar: async (usuarioId, uso) => usos.push([usuarioId, uso]) };
  const ai = new AiClient(new HttpService(axios.create()), cota);
  const conversa = { id: 'c1', usuarioId: 'u1', modo: 'assistido', oportunidadeId: null, mensagens: [], pendencia: null };
  const conversas = {
    abrir: async () => conversa,
    anexar: async (_id, mensagem) => conversa.mensagens.push(mensagem),
    definirPendencia: async () => {},
    definirResumo: async () => {},
  };
  const chat = new ChatService(conversas, ai, { executar: async () => ({}) }, { garantirVaga: async () => {} }, null);
  return { chat, conversa, usos };
}

function resposta(aoEscrever = () => {}) {
  const eventos = [];
  return {
    eventos,
    setHeader() {},
    flushHeaders() {}, on() {},
    write(bloco) {
      eventos.push(bloco);
      aoEscrever(bloco);
    },
    end() {},
  };
}

function eventos(res, nome) {
  return res.eventos.filter((e) => e.startsWith(`event: ${nome}\n`)).map((e) => JSON.parse(e.split('data: ')[1]));
}

test('primeiro token chega ao web antes do fim da geracao', async (t) => {
  const ordem = [];
  let liberar;
  const primeiroTokenEnviado = new Promise((resolve) => { liberar = resolve; });
  const url = await servidor(t, async (res) => {
    res.write(linha({ tipo: 'delta', texto: 'Ola, ' }));
    ordem.push('servidor:delta');
    await primeiroTokenEnviado;
    res.write(linha({ tipo: 'delta', texto: 'tudo certo.' }));
    ordem.push('servidor:fim');
    res.end(linha({ tipo: 'fim', conteudo: [{ type: 'text', text: 'Ola, tudo certo.' }], parada: 'end_turn', uso: usoFinal, modelo: 'claude-teste' }));
  });
  const { chat, conversa, usos } = montar(url);
  const res = resposta((bloco) => {
    if (bloco.startsWith('event: token')) {
      ordem.push('web:token');
      liberar();
    }
  });

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'oi' });

  assert.deepEqual(ordem.slice(0, 3), ['servidor:delta', 'web:token', 'servidor:fim']);
  assert.deepEqual(eventos(res, 'token').map((e) => e.delta), ['Ola, ', 'tudo certo.']);
  assert.equal(eventos(res, 'fim_turno')[0].motivo, 'completo');
  assert.equal(conversa.mensagens.at(-1).papel, 'assistant');
  assert.equal(conversa.mensagens.at(-1).conteudo, 'Ola, tudo certo.');
  assert.deepEqual(usos, [['u1', usoFinal]]);
});

test('falha no meio do stream nao grava texto parcial e registra o uso', async (t) => {
  const url = await servidor(t, async (res) => {
    res.write(linha({ tipo: 'delta', texto: 'Comecei a ' }));
    res.end(linha({ tipo: 'erro', detail: 'O copiloto está indisponível no momento.', interrompido: true, uso: { ...usoFinal, saida: 0 } }));
  });
  const { chat, conversa, usos } = montar(url);
  const res = resposta();

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'oi' });

  assert.deepEqual(eventos(res, 'token').map((e) => e.delta), ['Comecei a ']);
  const [erro] = eventos(res, 'erro');
  assert.equal(erro.recuperavel, true);
  assert.match(erro.mensagem, /interrompida/);
  assert.equal(eventos(res, 'fim_turno')[0].motivo, 'erro');
  assert.ok(conversa.mensagens.every((m) => m.papel !== 'assistant'));
  assert.ok(conversa.mensagens.every((m) => !m.conteudo.includes('Comecei a') || m.papel === 'evento'));
  assert.deepEqual(usos, [['u1', { ...usoFinal, saida: 0 }]]);
});

test('conexao que cai depois de um delta encerra o passo com erro recuperavel', async (t) => {
  const url = await servidor(t, async (res) => {
    res.write(linha({ tipo: 'delta', texto: 'Parcial' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    res.destroy();
  });
  const { chat, conversa } = montar(url);
  const res = resposta();

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'oi' });

  assert.equal(eventos(res, 'token').length, 1);
  assert.equal(eventos(res, 'erro')[0].recuperavel, true);
  assert.ok(conversa.mensagens.every((m) => m.papel !== 'assistant'));
});

test('falha antes do primeiro delta segue o erro de servico de sempre', async (t) => {
  const url = await servidor(t, async (res) => {
    res.end(linha({ tipo: 'erro', detail: 'O copiloto está indisponível no momento. Tente novamente em instantes.', interrompido: false, uso: null }));
  });
  const { chat, usos } = montar(url);
  const res = resposta();

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'oi' });

  assert.equal(eventos(res, 'token').length, 0);
  assert.match(eventos(res, 'erro')[0].mensagem, /indisponível no momento/);
  assert.deepEqual(usos, []);
});

test('delta com caractere multibyte partido entre pacotes chega inteiro', async (t) => {
  const url = await servidor(t, async (res) => {
    const bytes = Buffer.from(linha({ tipo: 'delta', texto: 'Ação é ótima' }), 'utf8');
    assert.equal(bytes[26], 0xc3);
    res.write(bytes.subarray(0, 27));
    await new Promise((resolve) => setTimeout(resolve, 10));
    res.write(bytes.subarray(27));
    res.end(linha({ tipo: 'fim', conteudo: [{ type: 'text', text: 'Ação é ótima' }], parada: 'end_turn', uso: usoFinal }));
  });
  const { chat } = montar(url);
  const res = resposta();

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'oi' });

  assert.deepEqual(eventos(res, 'token').map((e) => e.delta), ['Ação é ótima']);
});

function desconectavel() {
  const ouvintes = {};
  const res = resposta();
  res.on = (evento, fn) => {
    ouvintes[evento] = fn;
  };
  res.desconectar = () => {
    res.destroyed = true;
    ouvintes.close?.();
  };
  return res;
}

test('web desconecta no meio do stream: a api cancela o ai-service, para de pedir passos e registra o uso parcial', async (t) => {
  let pedidos = 0;
  let avisarFechamento;
  const fechou = new Promise((resolve) => { avisarFechamento = resolve; });
  const usoParcial = { entrada: 1200, saida: 0, cacheLida: 0, cacheEscrita: 0, chamadas: 1 };
  const url = await servidor(t, async (res) => {
    pedidos += 1;
    res.on('close', () => avisarFechamento(res.writableFinished));
    res.write(linha({ tipo: 'uso', uso: usoParcial }));
    res.write(linha({ tipo: 'delta', texto: 'Comecando ' }));
  });
  const { chat, conversa, usos } = montar(url);
  const res = desconectavel();
  const escrever = res.write;
  res.write = (bloco) => {
    escrever(bloco);
    if (bloco.startsWith('event: token')) res.desconectar();
  };

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'oi' });

  assert.equal(await fechou, false);
  assert.equal(pedidos, 1);
  assert.deepEqual(usos, [['u1', usoParcial]]);
  assert.equal(eventos(res, 'token').length, 1);
  assert.equal(eventos(res, 'fim_turno').length, 0);
  assert.equal(eventos(res, 'erro').length, 0);
  assert.ok(conversa.mensagens.every((m) => m.papel !== 'assistant'));
  assert.equal(conversa.mensagens.at(-1).dados.evento, 'cancelado');
});

test('web desconecta durante a tool: a api nao pede o passo seguinte', async () => {
  const { ChatService } = require('../dist/copiloto/chat.service');
  const sinais = [];
  const ai = {
    copilotoTurnStream: async (_payload, _opcoes, _aoDelta, sinal) => {
      sinais.push(sinal);
      return { conteudo: [{ type: 'tool_use', id: 'toolu_perfil', name: 'ler_perfil', input: {} }], parada: 'tool_use' };
    },
  };
  const res = desconectavel();
  const executor = {
    executar: async () => {
      res.desconectar();
      return { nome: 'Pessoa' };
    },
  };
  const conversa = { id: 'c2', usuarioId: 'u1', modo: 'assistido', oportunidadeId: null, mensagens: [], pendencia: null };
  const conversas = { abrir: async () => conversa, anexar: async () => {}, definirPendencia: async () => {}, definirResumo: async () => {} };
  const chat = new ChatService(conversas, ai, executor, { garantirVaga: async () => {} }, null);

  await chat.chat(res, { userId: 'u1' }, { mensagem: 'leia meu perfil' });

  assert.equal(sinais.length, 1);
  assert.equal(sinais[0].aborted, true);
  assert.deepEqual(conversa.mensagens.map((m) => m.papel), ['user', 'assistant', 'tool', 'evento']);
  assert.equal(conversa.mensagens.at(-1).dados.evento, 'cancelado');
  assert.equal(eventos(res, 'fim_turno').length, 0);
});
