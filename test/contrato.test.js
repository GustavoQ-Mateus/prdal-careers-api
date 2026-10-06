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
  const resolver = (schema) => schema.$ref ? resolver(gerado.components.schemas[schema.$ref.split('/').at(-1)]) : schema.allOf ? resolver(schema.allOf[0]) : schema;
  const hoje = resolver(gerado.paths['/v1/hoje'].get.responses['200'].content['application/json'].schema);
  assert.equal(resolver(hoje.properties.hoje.items).properties.quando.format, 'date-time');
  assert.ok(resolver(hoje.properties.atividadeRecente.items).properties.descricao);
  const curriculo = resolver(gerado.paths['/v1/curriculos/{id}'].get.responses['200'].content['application/json'].schema);
  assert.equal(resolver(curriculo.properties.analiseFinal).properties.score.type, 'number');
  assert.equal(resolver(curriculo.properties.breakdown).properties.faltando.type, 'array');
  assert.ok(gerado.components.schemas.CopilotoEvento.oneOf.length >= 8);
  const telemetria = gerado.paths['/v1/telemetria/eventos'].post;
  assert.deepEqual(telemetria.security, [{ prdal_access: [] }]);
  assert.equal(gerado.components.securitySchemes.prdal_access.in, 'cookie');
  assert.equal(gerado.components.securitySchemes.prdal_access.name, 'prdal_access');
  assert.deepEqual(Object.keys(telemetria.responses), ['204']);
  assert.equal(telemetria.responses['204'].content, undefined);
  const pedidos = telemetria.requestBody.content['application/json'].schema.oneOf;
  assert.equal(pedidos.length, 2);
  assert.deepEqual(pedidos.map((pedido) => pedido.properties.evento.enum[0]), ['copiloto_primeira_mensagem', 'copiloto_acao_rapida']);
  assert.deepEqual(pedidos[0].required, ['evento', 'sessaoId']);
  assert.deepEqual(pedidos[1].required, ['evento', 'sessaoId', 'acao']);
  const { ACOES_RAPIDAS, SESSAO_ID_PADRAO } = require('../dist/telemetria/telemetria.dto');
  assert.deepEqual(pedidos[1].properties.acao.enum, [...ACOES_RAPIDAS]);
  assert.deepEqual(pedidos[0].properties.sessaoId, { type: 'string', minLength: 1, maxLength: 64, pattern: SESSAO_ID_PADRAO });
  assert.ok(gerado.paths['/v1/contexto/upload'].post.requestBody.content['multipart/form-data']);
  assert.equal(gerado.components.schemas.PerfilMestreDto.properties.endereco.oneOf.length, 2);
  assert.equal(gerado.components.schemas.ExperienciaPerfilDto.properties.local.oneOf.length, 2);
  assert.throws(() => conferir(atual.replace('prdal-careers-api', 'contrato-divergente'), gerado), /contrato da api desatualizado/);
});
