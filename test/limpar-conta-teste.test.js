const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { lerOpcoes } = require('../dist/scripts/limpar-conta-teste');

const TESTE = { PRDAL_AMBIENTE: 'teste' };

test('dry-run e o padrao e a execucao exige --executar', () => {
  assert.deepEqual(lerOpcoes(['--email', 'conta@teste.dev'], TESTE), { email: 'conta@teste.dev', executar: false });
  assert.deepEqual(lerOpcoes(['--email=Conta@Teste.dev', '--dry-run'], TESTE), { email: 'conta@teste.dev', executar: false });
  assert.deepEqual(lerOpcoes(['--email', 'conta@teste.dev', '--executar'], { PRDAL_AMBIENTE: 'desenvolvimento' }), {
    email: 'conta@teste.dev',
    executar: true,
  });
  assert.throws(() => lerOpcoes(['--email', 'conta@teste.dev', '--dry-run', '--executar'], TESTE), /nao os dois/);
});

test('alvo por argumento e obrigatorio', () => {
  assert.throws(() => lerOpcoes([], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--executar'], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--email'], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--email', 'sem-arroba'], TESTE), /--email/);
  assert.throws(() => lerOpcoes(['--alvo', 'conta@teste.dev'], TESTE), /desconhecido/);
});

test('recusa fora de teste ou desenvolvimento', () => {
  for (const env of [{}, { PRDAL_AMBIENTE: 'producao' }, { PRDAL_AMBIENTE: '' }, { NODE_ENV: 'development' }]) {
    assert.throws(() => lerOpcoes(['--email', 'conta@teste.dev', '--executar'], env), /PRDAL_AMBIENTE/);
  }
});

test('o script recusa antes de conectar em banco e nao tem email no codigo', () => {
  const script = path.join(__dirname, '../dist/scripts/limpar-conta-teste.js');
  const { PRDAL_AMBIENTE: _ignorado, ...env } = process.env;
  const execucao = spawnSync(process.execPath, [script, '--email', 'conta@teste.dev', '--executar'], {
    env: { ...env, DATABASE_URL: 'postgresql://ninguem:x@127.0.0.1:1/nada' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(execucao.status, 1);
  assert.match(execucao.stderr, /limpeza recusada/);

  const fonte = readFileSync(path.join(__dirname, '../src/scripts/limpar-conta-teste.ts'), 'utf8');
  assert.doesNotMatch(fonte, /[\w.+-]+@[\w-]+\.[\w.]+/);
});

test('limpeza conta conversas no postgres e refaz o conhecimento do perfil preservando as notas', { skip: require('./helpers/postgres').SEM_PG }, async (t) => {
  const { randomUUID } = require('node:crypto');
  const { prismaDoBanco, novoUsuario } = require('./helpers/postgres');
  const { simular, reindexarConhecimento } = require('../dist/scripts/limpar-conta-teste');
  const { DocumentosRagRepositorio } = require('../dist/repositorios/documentos-rag.repositorio');
  const prisma = prismaDoBanco(t);
  const usuario = await novoUsuario(prisma);
  await prisma.copilotoConversa.create({ data: { usuarioId: usuario.id, modo: 'assistido' } });
  const nota = await prisma.notaObsidian.create({ data: { usuarioId: usuario.id, titulo: 'n', corpo: 'Kubernetes' } });
  await prisma.documentoRag.create({ data: { usuarioId: usuario.id, origem: 'nota', origemId: nota.id, tipo: 'nota', factual: false, titulo: 'n', texto: 'Kubernetes', notaId: nota.id } });
  await prisma.documentoRag.create({ data: { id: randomUUID(), usuarioId: usuario.id, origem: 'perfil', origemId: 'resumo', tipo: 'resumo', factual: true, titulo: 'Resumo', texto: 'antigo' } });

  const contagem = await simular(prisma, usuario.id);
  assert.equal(contagem.copiloto_conversas, 1);
  assert.equal(contagem.documentos_rag_perfil_ou_candidatura, 1);

  const indexados = [];
  const rag = { modeloAtual: async () => 'modelo', indexar: async (doc) => (indexados.push(doc.tipo), 1) };
  const perfil = { resumo: 'Analista de dados', experiencias: [], formacao: [], certificacoes: [], idiomas: ['Ingles'], skills: ['SQL'] };
  const resultado = await reindexarConhecimento(new DocumentosRagRepositorio(prisma), prisma, rag, usuario.id, perfil);
  assert.deepEqual({ removidos: resultado.removidos, inseridos: resultado.inseridos, total: resultado.total }, { removidos: 1, inseridos: 3, total: 4 });
  assert.deepEqual(indexados.sort(), ['idiomas', 'nota', 'resumo', 'skills']);
  const resumo = await prisma.documentoRag.findFirst({ where: { usuarioId: usuario.id, tipo: 'resumo' } });
  assert.equal(resumo.texto, 'Analista de dados');
  assert.equal(resumo.factual, true);
});
