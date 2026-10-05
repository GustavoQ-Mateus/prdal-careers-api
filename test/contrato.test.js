const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { gerarContrato, serializarContrato } = require('../dist/contrato/gerar');

function conferir(atual, gerado) {
  assert.equal(atual.replace(/\r\n/g, '\n'), serializarContrato(gerado), 'contrato da api desatualizado');
}

test('contrato da api coincide com os controllers e DTOs', async () => {
  const gerado = await gerarContrato();
  const atual = readFileSync(path.join(__dirname, '../contrato/openapi.json'), 'utf8');
  conferir(atual, gerado);
  assert.ok(gerado.paths['/v1/oportunidades']);
  assert.ok(gerado.paths['/health']);
  assert.ok(gerado.paths['/ready']);
  assert.ok(!gerado.paths['/v1/health']);
  const login = gerado.components.schemas.LoginDto;
  assert.deepEqual(login.required, ['email', 'senha']);
  const resposta = gerado.paths['/v1/auth/login'].post.responses['201'].content['application/json'].schema;
  assert.ok(gerado.components.schemas[resposta.$ref.split('/').at(-1)].properties.csrfToken);
  assert.ok(gerado.paths['/v1/copiloto/chat'].post.responses['201'].content['text/event-stream']);
  assert.deepEqual(gerado.paths['/v1/copiloto/chat'].post['x-eventos'], { $ref: '#/components/schemas/CopilotoEvento' });
  const resolver = (schema) => schema.$ref ? gerado.components.schemas[schema.$ref.split('/').at(-1)] : schema;
  const hoje = resolver(gerado.paths['/v1/hoje'].get.responses['200'].content['application/json'].schema);
  assert.equal(resolver(hoje.properties.hoje.items).properties.quando.format, 'date-time');
  assert.ok(resolver(hoje.properties.atividadeRecente.items).properties.descricao);
  const curriculo = resolver(gerado.paths['/v1/curriculos/{id}'].get.responses['200'].content['application/json'].schema);
  assert.equal(resolver(curriculo.properties.analiseFinal).properties.score.type, 'number');
  assert.equal(resolver(curriculo.properties.breakdown).properties.faltando.type, 'array');
  assert.ok(gerado.components.schemas.CopilotoEvento.oneOf.length >= 8);
  assert.ok(gerado.paths['/v1/contexto/upload'].post.requestBody.content['multipart/form-data']);
  assert.equal(gerado.components.schemas.PerfilMestreDto.properties.endereco.oneOf.length, 2);
  assert.equal(gerado.components.schemas.ExperienciaPerfilDto.properties.local.oneOf.length, 2);
  assert.throws(() => conferir(atual.replace('prdal-careers-api', 'contrato-divergente'), gerado), /contrato da api desatualizado/);
});
