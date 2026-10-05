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
  assert.ok(gerado.paths['/v1/contexto/upload'].post.requestBody.content['multipart/form-data']);
  assert.equal(gerado.components.schemas.PerfilMestreDto.properties.endereco.oneOf.length, 2);
  assert.equal(gerado.components.schemas.ExperienciaPerfilDto.properties.local.oneOf.length, 2);
  assert.throws(() => conferir(atual.replace('prdal-careers-api', 'contrato-divergente'), gerado), /contrato da api desatualizado/);
});
