require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { PATH_METADATA, METHOD_METADATA } = require('@nestjs/common/constants');
const { RequestMethod } = require('@nestjs/common');
const { subirApp, autenticado } = require('./helpers/app-teste');

function controllers() {
  const fs = require('node:fs');
  const path = require('node:path');
  const raiz = path.join(__dirname, '..', 'dist');
  const arquivos = (pasta) => fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name);
    return item.isDirectory() ? arquivos(caminho) : [caminho];
  });
  return arquivos(raiz)
    .filter((arquivo) => arquivo.endsWith('.controller.js'))
    .flatMap((arquivo) => Object.values(require(arquivo)))
    .filter((exportado) => typeof exportado === 'function' && Reflect.getMetadata(PATH_METADATA, exportado) !== undefined);
}

function rotas() {
  const lista = [];
  for (const controller of controllers()) {
    const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '').replace(/^\/|\/$/g, '');
    for (const nome of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = controller.prototype[nome];
      const caminho = Reflect.getMetadata(PATH_METADATA, handler);
      if (caminho === undefined || nome === 'constructor') continue;
      const metodo = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
      lista.push(`${metodo} /${[base, String(caminho).replace(/^\/|\/$/g, '')].filter(Boolean).join('/')}`);
    }
  }
  return lista;
}

test('rotas legadas saem e as que o board e o grafo usam ficam', () => {
  const existentes = rotas();
  for (const removida of [
    'GET /hello',
    'GET /dashboard',
    'GET /vagas',
    'POST /vagas',
    'GET /vagas/:id',
    'PUT /vagas/:id',
    'DELETE /vagas/:id',
    'GET /vagas/:id/curriculos',
    'POST /vagas/:id/gerar-cv',
    'GET /pipeline/canvas',
    'PUT /pipeline/canvas',
    'POST /copiloto/keywords-previa',
    'POST /copiloto/rag/consulta',
    'POST /copiloto/score',
    'POST /banco-vagas/import',
    'GET /banco-vagas',
    'POST /banco-vagas/:id/ativar',
  ]) {
    assert.ok(!existentes.includes(removida), removida);
  }
  for (const mantida of ['GET /pipeline', 'GET /pipeline/grafo', 'GET /oportunidades/:id/curriculos', 'POST /oportunidades/importar', 'POST /oportunidades/entradas/:id/ativar']) {
    assert.ok(existentes.includes(mantida), mantida);
  }
});

test('curriculos da oportunidade respondem como a rota de vagas respondia', async (t) => {
  const { OportunidadesController } = require('../dist/oportunidades/oportunidades.controller');
  const { OportunidadesService } = require('../dist/oportunidades/oportunidades.service');
  const { CurriculosService } = require('../dist/curriculos/curriculos.service');
  const chamadas = [];
  const lista = [{ id: 'cv1', rotulo: 'Versao 1', score: 81 }];
  const { ThrottlerModule } = require('@nestjs/throttler');
  const { JANELAS } = require('../dist/limites/limite-requisicoes');
  const { CotaTokensService } = require('../dist/cota/cota-tokens.service');
  const { url } = await subirApp(t, {
    imports: [ThrottlerModule.forRoot(JANELAS)],
    controllers: [OportunidadesController],
    providers: [
      { provide: CotaTokensService, useValue: { verificar: async () => {} } },
      { provide: OportunidadesService, useValue: {} },
      { provide: CurriculosService, useValue: { listarPorVaga: async (...args) => { chamadas.push(args); return lista; } } },
    ],
  });
  const resposta = await fetch(`${url}/oportunidades/v1/curriculos`, { headers: autenticado('usuario-1') });
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), lista);
  assert.deepEqual(chamadas, [['usuario-1', 'v1']]);
});

test('preferencias nao guardam mais o canvas', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
  assert.doesNotMatch(schema, /canvas_|pipeline_layouts|PipelineLayout|banco_vagas|BancoVaga/);
});
