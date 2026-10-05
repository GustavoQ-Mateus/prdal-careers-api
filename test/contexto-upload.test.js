const assert = require('node:assert/strict');
const test = require('node:test');
const { subirApp, autenticado } = require('./helpers/app-teste');

function falsos() {
  const gravados = { notas: [], rag: [], lotes: [] };
  const documentos = {
    inserirNotas: async (itens) => {
      gravados.notas.push(...itens.map(({ nota }) => nota));
      gravados.rag.push(...itens.map(({ documento }) => documento));
    },
  };
  const lotes = { criar: async (_usuario, _tipo, ids) => (gravados.lotes.push(ids), { id: 'lote-1' }) };
  return { gravados, documentos, lotes };
}

async function subir(t) {
  const { ContextoController } = require('../dist/contexto/contexto.controller');
  const { ContextoService } = require('../dist/contexto/contexto.service');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { DocumentosRagRepositorio } = require('../dist/repositorios/documentos-rag.repositorio');
  const { LotesService } = require('../dist/lotes/lotes.service');
  const { gravados, documentos, lotes } = falsos();
  const { url } = await subirApp(t, {
    controllers: [ContextoController],
    providers: [
      ContextoService,
      { provide: PrismaService, useValue: {} },
      { provide: DocumentosRagRepositorio, useValue: documentos },
      { provide: LotesService, useValue: lotes },
    ],
  });
  const enviar = (arquivos) => {
    const form = new FormData();
    for (const [nome, conteudo] of arquivos) form.append('arquivos', new Blob([conteudo]), nome);
    return fetch(`${url}/contexto/upload`, {
      method: 'POST',
      headers: { ...autenticado('usuario-vitima') },
      body: form,
    });
  };
  return { gravados, enviar };
}

function nadaGravado(gravados) {
  assert.deepEqual(gravados, { notas: [], rag: [], lotes: [] });
}

test('executavel com cabecalho MZ retorna 415 e nao e gravado nem indexado', async (t) => {
  const { gravados, enviar } = await subir(t);
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.from([0x90, 0x00, 0x03, 0x00]), Buffer.from('binario')]);
  for (const nome of ['malware.exe', 'malware.md', 'malware.txt']) {
    const resposta = await enviar([[nome, exe]]);
    assert.equal(resposta.status, 415, nome);
    assert.equal((await resposta.json()).statusCode, 415);
  }
  nadaGravado(gravados);
});

test('UTF-8 invalido retorna 415', async (t) => {
  const { gravados, enviar } = await subir(t);
  const resposta = await enviar([['nota.md', Buffer.from([0x23, 0x20, 0xc3, 0x28, 0xff])]]);
  assert.equal(resposta.status, 415);
  nadaGravado(gravados);
});

test('um arquivo invalido no lote impede a gravacao dos validos', async (t) => {
  const { gravados, enviar } = await subir(t);
  const resposta = await enviar([
    ['valida.md', '# Nota valida'],
    ['imagem.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ]);
  assert.equal(resposta.status, 415);
  nadaGravado(gravados);
});

test('markdown de 25 MB retorna 413, nunca 500', async (t) => {
  const { gravados, enviar } = await subir(t);
  const resposta = await enviar([['enorme.md', Buffer.alloc(25 * 1024 * 1024, 'a')]]);
  assert.equal(resposta.status, 413);
  assert.match((await resposta.json()).message, /bytes/);
  nadaGravado(gravados);
});

test('mais de 10 arquivos retorna 413', async (t) => {
  const { gravados, enviar } = await subir(t);
  const arquivos = Array.from({ length: 11 }, (_, i) => [`nota-${i}.md`, `# Nota ${i}`]);
  const resposta = await enviar(arquivos);
  assert.equal(resposta.status, 413);
  assert.match((await resposta.json()).message, /10 arquivos/);
  nadaGravado(gravados);
});

test('md e txt em UTF-8 sao gravados e indexados', async (t) => {
  const { gravados, enviar } = await subir(t);
  const resposta = await enviar([
    ['Projeto.md', '\uFEFF# Projeto\n\nMigrei o sistema de faturamento.'],
    ['ideias.TXT', 'Integração com SAP\tem 2023\r\n'],
  ]);
  assert.equal(resposta.status, 201);
  assert.deepEqual(gravados.notas.map((n) => [n.titulo, n.corpo]), [
    ['Projeto', '# Projeto\n\nMigrei o sistema de faturamento.'],
    ['ideias', 'Integração com SAP\tem 2023\r\n'],
  ]);
  assert.equal(gravados.rag.length, 2);
  assert.equal(gravados.lotes.length, 1);
});

test('nota enviada sem marca e apoio, nunca fonte factual', async (t) => {
  const { gravados, enviar } = await subir(t);
  const resposta = await enviar([['planos.md', 'quero estudar Kubernetes']]);
  assert.equal(resposta.status, 201);
  assert.equal(gravados.notas[0].historico, false);
  assert.equal(gravados.rag[0].tipo, 'nota');
  assert.equal(gravados.rag[0].factual, false);
});

test('nota marcada como historico vira fonte factual', async (t) => {
  const { gravados, url } = await subirComUrl(t);
  const form = new FormData();
  form.append('historico', 'true');
  form.append('arquivos', new Blob(['Migrei o faturamento para Kubernetes em 2023.']), 'projeto.md');
  const resposta = await fetch(`${url}/contexto/upload`, {
    method: 'POST',
    headers: { ...autenticado('usuario-vitima') },
    body: form,
  });
  assert.equal(resposta.status, 201);
  assert.equal(gravados.notas[0].historico, true);
  assert.equal(gravados.rag[0].factual, true);
});

test('historico com valor invalido retorna 400 e nada e gravado', async (t) => {
  const { gravados, url } = await subirComUrl(t);
  const form = new FormData();
  form.append('historico', 'talvez');
  form.append('arquivos', new Blob(['texto']), 'nota.md');
  const resposta = await fetch(`${url}/contexto/upload`, {
    method: 'POST',
    headers: { ...autenticado('usuario-vitima') },
    body: form,
  });
  assert.equal(resposta.status, 400);
  nadaGravado(gravados);
});

async function subirComUrl(t) {
  const { ContextoController } = require('../dist/contexto/contexto.controller');
  const { ContextoService } = require('../dist/contexto/contexto.service');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { DocumentosRagRepositorio } = require('../dist/repositorios/documentos-rag.repositorio');
  const { LotesService } = require('../dist/lotes/lotes.service');
  const { gravados, documentos, lotes } = falsos();
  const { url } = await subirApp(t, {
    controllers: [ContextoController],
    providers: [
      ContextoService,
      { provide: PrismaService, useValue: {} },
      { provide: DocumentosRagRepositorio, useValue: documentos },
      { provide: LotesService, useValue: lotes },
    ],
  });
  return { gravados, url };
}
