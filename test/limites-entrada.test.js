require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { Body, Controller, Post, ValidationPipe } = require('@nestjs/common');
const { subirApp } = require('./helpers/app-teste');

async function subir(t) {
  const { configurarCorpo } = require('../dist/config/corpo');
  const { CriarOportunidadeDto } = require('../dist/oportunidades/oportunidade.dto');
  const { ChatDto, RespostasFormularioDto } = require('../dist/copiloto/copiloto.dto');
  const { EditarCurriculoDto } = require('../dist/curriculos/curriculo.dto');

  class Eco {
    oportunidade(dto) { return dto; }
    chat(dto) { return dto; }
    curriculo(dto) { return dto; }
    formulario(dto) { return dto; }
  }
  for (const [metodo, dto] of [
    ['oportunidade', CriarOportunidadeDto],
    ['chat', ChatDto],
    ['curriculo', EditarCurriculoDto],
    ['formulario', RespostasFormularioDto],
  ]) {
    Reflect.defineMetadata('design:paramtypes', [dto], Eco.prototype, metodo);
    Body()(Eco.prototype, metodo, 0);
    Post(metodo)(Eco.prototype, metodo, Object.getOwnPropertyDescriptor(Eco.prototype, metodo));
  }
  Controller('eco')(Eco);

  const { url } = await subirApp(t, {
    controllers: [Eco],
    bodyParser: false,
    configurar: (app) => {
      configurarCorpo(app);
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    },
  });
  return (rota, corpo) =>
    fetch(`${url}/eco/${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    });
}

const oportunidade = (descricao) => ({ titulo: 'Dev', empresa: 'Empresa', descricao });

test('descricao de vaga com 90 KB e rejeitada pela validacao', async (t) => {
  const enviar = await subir(t);
  const resposta = await enviar('oportunidade', oportunidade('a'.repeat(90 * 1024)));
  assert.equal(resposta.status, 400);
  const corpo = await resposta.json();
  assert.equal(corpo.statusCode, 400);
  assert.ok(corpo.message.some((m) => /descricao/.test(m)), corpo.message);
});

test('limites coerentes com o uso', async (t) => {
  const enviar = await subir(t);
  assert.equal((await enviar('oportunidade', oportunidade('a'.repeat(30000)))).status, 201);
  assert.equal((await enviar('oportunidade', oportunidade('a'.repeat(30001)))).status, 400);
  assert.equal((await enviar('oportunidade', { ...oportunidade('vaga'), titulo: 't'.repeat(201) })).status, 400);
  assert.equal((await enviar('oportunidade', { ...oportunidade('vaga'), empresa: 'e'.repeat(201) })).status, 400);
  assert.equal((await enviar('chat', { mensagem: 'm'.repeat(8000) })).status, 201);
  assert.equal((await enviar('chat', { mensagem: 'm'.repeat(8001) })).status, 400);
  assert.equal((await enviar('curriculo', { markdown: 'c'.repeat(50000) })).status, 201);
  assert.equal((await enviar('curriculo', { markdown: 'c'.repeat(50001) })).status, 400);
  const campos = (n) => ({ oportunidadeId: 'op-1', campos: Array.from({ length: n }, (_, i) => `campo ${i}`) });
  assert.equal((await enviar('formulario', campos(50))).status, 201);
  assert.equal((await enviar('formulario', campos(51))).status, 400);
});

test('corpo acima do limite do parser retorna 413 no formato de erro da api', async (t) => {
  const enviar = await subir(t);
  const resposta = await enviar('oportunidade', oportunidade('a'.repeat(2 * 1024 * 1024)));
  assert.equal(resposta.status, 413);
  assert.deepEqual(await resposta.json(), {
    erro: { codigo: 'corpo_grande_demais', mensagem: 'corpo da requisicao acima do limite de 1mb', requestId: null },
  });
});
