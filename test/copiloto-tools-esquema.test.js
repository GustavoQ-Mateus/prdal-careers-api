require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { IsUrl } = require('class-validator');
const { TipoAcaoOportunidade } = require('@prisma/client');
const { esquemaDoDto } = require('../dist/copiloto/esquema-dto');
const {
  LIMITE_OPCIONAIS_ESTRITOS,
  LIMITE_TOOLS_ESTRITAS,
  TOOLS,
  TOOLS_NATIVAS,
} = require('../dist/copiloto/tools');

const opcionais = (tool) =>
  Object.keys(tool.input_schema.properties).length - tool.input_schema.required.length;

test('toda tool tem schema derivado do DTO, objeto fechado e na mesma ordem do catalogo', () => {
  assert.deepEqual(TOOLS_NATIVAS.map((t) => t.name), TOOLS.map((t) => t.nome));
  for (const [indice, nativa] of TOOLS_NATIVAS.entries()) {
    assert.deepEqual(nativa.input_schema, esquemaDoDto(TOOLS[indice].dto, TOOLS[indice].esquema).schema, nativa.name);
    assert.equal(nativa.input_schema.type, 'object');
    assert.equal(nativa.input_schema.additionalProperties, false);
    assert.ok(nativa.description.length > 10, nativa.name);
  }
});

test('valores fechados viram enum, inclusive o tipo de acao do proximo passo', () => {
  const passo = TOOLS_NATIVAS.find((t) => t.name === 'definir_proximo_passo');
  assert.deepEqual(passo.input_schema.properties.tipo.enum, Object.values(TipoAcaoOportunidade));
  assert.deepEqual(passo.input_schema.required, ['titulo', 'tipo']);
  assert.equal(passo.input_schema.properties.principal.type, 'boolean');
  assert.equal(passo.input_schema.properties.venceEm.format, 'date-time');
  assert.equal(passo.input_schema.properties.candidaturaId, undefined);
  const mover = TOOLS_NATIVAS.find((t) => t.name === 'mover_estagio');
  assert.ok(mover.input_schema.properties.destino.enum.includes('ENTREVISTA'));
  const listar = TOOLS_NATIVAS.find((t) => t.name === 'listar_curriculos');
  assert.deepEqual(listar.input_schema.properties.vinculado.enum, ['true', 'false']);
  assert.equal(listar.input_schema.properties.scoreMinimo.type, 'integer');
});

test('strict respeita os limites da Anthropic e nao leva restricao sem suporte', () => {
  const estritas = TOOLS_NATIVAS.filter((t) => t.strict);
  assert.ok(estritas.length <= LIMITE_TOOLS_ESTRITAS);
  assert.ok(estritas.reduce((soma, t) => soma + opcionais(t), 0) <= LIMITE_OPCIONAIS_ESTRITOS);
  for (const nome of ['registrar_oportunidade', 'definir_proximo_passo', 'mover_estagio', 'gerar_curriculo', 'analisar_ats', 'redigir_mensagem_recrutador']) {
    assert.equal(TOOLS_NATIVAS.find((t) => t.name === nome).strict, true, nome);
  }
  const texto = JSON.stringify(TOOLS_NATIVAS);
  for (const proibido of ['maxLength', 'minLength', 'minimum', 'maximum', 'maxItems']) {
    assert.doesNotMatch(texto, new RegExp(proibido));
  }
});

test('validador sem equivalente em JSON Schema falha cedo', () => {
  class ComUrl {}
  IsUrl()(ComUrl.prototype, 'site');
  assert.throws(() => esquemaDoDto(ComUrl), /isUrl/);
});
