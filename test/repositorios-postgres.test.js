const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { SEM_PG, prismaDoBanco, novoUsuario } = require('./helpers/postgres');
const { paraTrocas } = require('../dist/copiloto/historico');

function repositorios(prisma) {
  const { ConversasRepositorio } = require('../dist/repositorios/conversas.repositorio');
  const { DocumentosRagRepositorio } = require('../dist/repositorios/documentos-rag.repositorio');
  const { NotasRepositorio } = require('../dist/repositorios/notas.repositorio');
  return {
    conversas: new ConversasRepositorio(prisma),
    documentos: new DocumentosRagRepositorio(prisma),
    notas: new NotasRepositorio(prisma),
  };
}

async function novaVaga(prisma, usuarioId) {
  return prisma.vaga.create({ data: { usuarioId, titulo: 'Dev', empresa: 'Empresa', descricao: 'vaga', keywords: [] } });
}

test('trocas a partir de uma janela carregada pelo meio batem com as do historico inteiro', () => {
  const mensagens = [
    { papel: 'user', conteudo: 'primeira' },
    { papel: 'assistant', conteudo: 'resposta' },
    { papel: 'user', conteudo: 'segunda' },
    { papel: 'assistant', conteudo: '', blocos: [{ type: 'tool_use', id: 'c1', name: 'ler_perfil', input: {} }] },
    { papel: 'tool', tool: 'ler_perfil', conteudo: '{}', dados: { callId: 'c1' } },
    { papel: 'user', conteudo: 'terceira' },
    { papel: 'assistant', conteudo: 'fim' },
  ];
  assert.deepEqual(paraTrocas(mensagens.slice(2), 2, 2), paraTrocas(mensagens, 2));
  assert.deepEqual(paraTrocas(mensagens.slice(5), 5, 5).map((t) => t.indice), [5]);
});

test('conversa: ordem estavel com anexos concorrentes, janela pelo resumo e lista por SQL', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { conversas } = repositorios(prisma);
  const usuario = await novoUsuario(prisma);
  const conversa = await conversas.criar(usuario.id, 'assistido', null);

  await conversas.anexar(conversa.id, { papel: 'user', conteudo: '  pergunta inicial  ' });
  await Promise.all(Array.from({ length: 20 }, (_, i) => conversas.anexar(conversa.id, { papel: 'assistant', conteudo: `r${i}` })));
  await conversas.anexar(conversa.id, { papel: 'evento', conteudo: '   ' });

  const linhas = await prisma.copilotoMensagem.findMany({ where: { conversaId: conversa.id }, orderBy: { ordem: 'asc' } });
  assert.deepEqual(linhas.map((l) => l.ordem), Array.from({ length: 22 }, (_, i) => i));
  const salva = await prisma.copilotoConversa.findUnique({ where: { id: conversa.id } });
  assert.equal(salva.totalMensagens, 22);

  const completa = await conversas.buscarCompleta(usuario.id, conversa.id);
  assert.equal(completa.mensagens.length, 22);
  assert.deepEqual(completa.mensagens[0], { papel: 'user', conteudo: '  pergunta inicial  ' });

  await conversas.definirResumo(conversa.id, { texto: 'resumo', ate: 15 });
  const janela = await conversas.abrirJanela(usuario.id, conversa.id);
  assert.equal(janela.inicioJanela, 15);
  assert.equal(janela.mensagens.length, 7);
  assert.deepEqual(janela.resumo, { texto: 'resumo', ate: 15 });
  assert.equal(await conversas.abrirJanela('outro-usuario', conversa.id), null);

  const [listada] = await conversas.listar(usuario.id);
  assert.equal(listada.id, conversa.id);
  assert.equal(listada.totalMensagens, 22);
  assert.equal(listada.primeiraDoCandidato, '  pergunta inicial  ');
  assert.match(listada.ultimaComTexto, /^r\d+$/);
});

test('conversa: chave estrangeira com oportunidade e usuario', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { conversas } = repositorios(prisma);
  const usuario = await novoUsuario(prisma);
  const vaga = await novaVaga(prisma, usuario.id);
  const conversa = await conversas.criar(usuario.id, 'autopiloto', vaga.id);
  await conversas.anexar(conversa.id, { papel: 'user', conteudo: 'oi' });

  assert.equal((await conversas.listar(usuario.id, vaga.id)).length, 1);
  await assert.rejects(conversas.atualizarOportunidade(conversa.id, 'vaga-que-nao-existe'));
  await prisma.vaga.delete({ where: { id: vaga.id } });
  assert.equal((await conversas.buscarCompleta(usuario.id, conversa.id)).oportunidadeId, null);

  await prisma.usuario.delete({ where: { id: usuario.id } });
  assert.equal(await prisma.copilotoMensagem.count({ where: { conversaId: conversa.id } }), 0);
});

test('conversa: pendencia confirmada uma vez so e confirmacao duplicada mantem a primeira', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { conversas } = repositorios(prisma);
  const usuario = await novoUsuario(prisma);
  const conversa = await conversas.criar(usuario.id, 'assistido', null);
  await conversas.definirPendencia(conversa.id, { callId: 'call-1', tool: 'registrar_nota', efeito: 'escrita', args: { texto: 'x' } });

  const resultados = await Promise.all(Array.from({ length: 6 }, () => conversas.confirmarPendencia(conversa.id, 'call-1')));
  assert.equal(resultados.filter(Boolean).length, 1);
  assert.equal(resultados.find(Boolean).executando, true);
  assert.equal(await conversas.confirmarPendencia(conversa.id, 'outro-call'), null);

  await conversas.registrarConfirmacao(conversa.id, { callId: 'call-1', tool: 'registrar_nota', decisao: 'confirmar', resultado: { id: 'n1' }, concluidaEm: new Date() });
  await conversas.registrarConfirmacao(conversa.id, { callId: 'call-1', tool: 'registrar_nota', decisao: 'recusar', concluidaEm: new Date() });
  const confirmacao = await conversas.buscarConfirmacao(conversa.id, 'call-1');
  assert.equal(confirmacao.decisao, 'confirmar');
  assert.deepEqual(confirmacao.resultado, { id: 'n1' });

  await conversas.definirPendencia(conversa.id, null);
  assert.equal((await conversas.buscarCompleta(usuario.id, conversa.id)).pendencia, null);
});

test('documentos: reindexar preserva notas, nota apagada leva o documento e item de lote perde so a referencia', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { documentos, notas } = repositorios(prisma);
  const usuario = await novoUsuario(prisma);
  const nota = { id: randomUUID(), usuarioId: usuario.id, titulo: 'Nota', corpo: 'Kubernetes', historico: true, criadoEm: new Date() };
  const docNota = { id: randomUUID(), usuarioId: usuario.id, origem: 'nota', origemId: nota.id, tipo: 'nota', factual: true, titulo: 'Nota', texto: 'Kubernetes', notaId: nota.id, candidaturaId: null };
  await documentos.inserirNotas([{ nota, documento: docNota }]);
  const perfil = (id) => ({ id, usuarioId: usuario.id, origem: 'perfil', origemId: 'resumo', tipo: 'resumo', factual: true, titulo: 'Resumo', texto: 'r', notaId: null, candidaturaId: null });

  const primeira = await documentos.substituirPerfilECandidaturas(usuario.id, [perfil(randomUUID())]);
  const segunda = await documentos.substituirPerfilECandidaturas(usuario.id, [perfil(randomUUID())]);
  assert.equal(primeira.length, 2);
  assert.equal(segunda.length, 2);
  assert.ok(segunda.includes(docNota.id));
  assert.equal(await documentos.contar(usuario.id, 'perfil'), 1);
  assert.deepEqual((await notas.listar(usuario.id)).map((n) => n.historico), [true]);

  const lote = await prisma.lote.create({ data: { usuarioId: usuario.id, tipo: 'INGESTAO', total: 1, itens: { create: [{ documentoRagId: docNota.id }] } }, include: { itens: true } });
  await prisma.notaObsidian.delete({ where: { id: nota.id } });
  assert.equal(await documentos.buscar(docNota.id), null);
  const item = await prisma.loteItem.findUnique({ where: { id: lote.itens[0].id } });
  assert.equal(item.documentoRagId, null);
  const docPerfil = segunda.find((id) => id !== docNota.id);
  const vaga = await novaVaga(prisma, usuario.id);
  await assert.rejects(
    prisma.loteItem.update({ where: { id: item.id }, data: { documentoRagId: docPerfil, vagaId: vaga.id } }),
    /lote_itens_uma_referencia_chk/,
  );
});
