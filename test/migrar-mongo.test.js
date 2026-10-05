const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { SEM_PG, prismaDoBanco, novoUsuario } = require('./helpers/postgres');

function mongoFalso(colecoes) {
  return {
    collection: (nome) => ({
      countDocuments: async () => (colecoes[nome] ?? []).length,
      find: () => ({ toArray: async () => structuredClone(colecoes[nome] ?? []) }),
    }),
  };
}

test('migracao do mongo: grava tudo uma vez, explica o que nao migrou e liga os itens de lote', { skip: SEM_PG }, async (t) => {
  const prisma = prismaDoBanco(t);
  const { migrar } = require('../dist/scripts/migrar-mongo');
  const usuario = await novoUsuario(prisma);
  const vaga = await prisma.vaga.create({ data: { usuarioId: usuario.id, titulo: 'Dev', empresa: 'E', descricao: 'd', keywords: [] } });
  const id = () => randomUUID();
  const ids = { nota: id(), notaOrfa: id(), banco: id(), docPerfil: id(), docNota: id(), docCand: id(), conversa: id(), conversaOrfa: id() };
  const quando = new Date('2026-09-01T12:00:00Z');
  const colecoes = {
    notas_obsidian: [
      { _id: ids.nota, usuarioId: usuario.id, titulo: 'Kubernetes', corpo: 'Operei cluster', historico: true, criadoEm: quando },
      { _id: ids.notaOrfa, usuarioId: 'usuario-apagado', titulo: 'x', corpo: 'y', criadoEm: quando },
    ],
    banco_vagas: [
      { _id: ids.banco, usuarioId: usuario.id, titulo: 'Analista', empresa: 'B', fonte: null, descricao: 'desc', status: 'ATIVADA', categoria: null, nivel: null, keywords: [{ termo: 'SQL', peso: 3 }], origemRelacionalId: 'vaga-apagada', criadoEm: quando },
    ],
    documentos_rag: [
      { _id: ids.docPerfil, usuarioId: usuario.id, origem: 'perfil', origemId: 'formacao-0', titulo: 'Formacao', texto: 'ADS', criadoEm: quando },
      { _id: ids.docNota, usuarioId: usuario.id, origem: 'nota', origemId: ids.nota, tipo: 'nota', factual: true, titulo: 'Kubernetes', texto: 'Operei cluster', criadoEm: quando },
      { _id: ids.docCand, usuarioId: usuario.id, origem: 'candidatura', origemId: 'candidatura-apagada', titulo: 'c', texto: 'notas', criadoEm: quando },
    ],
    copiloto_conversas: [
      {
        _id: ids.conversa,
        usuarioId: usuario.id,
        modo: 'autopiloto',
        oportunidadeId: vaga.id,
        mensagens: [
          { papel: 'user', conteudo: 'gere meu curriculo' },
          { papel: 'assistant', conteudo: '', blocos: [{ type: 'tool_use', id: 'c1', name: 'gerar_curriculo', input: {} }] },
          { papel: 'tool', tool: 'gerar_curriculo', conteudo: '{}', dados: { callId: 'c1', ok: true, resultado: { jobId: 'job-1' } } },
        ],
        pendencia: null,
        resumo: { texto: 'resumo', ate: 1 },
        confirmacoes: [
          { callId: 'c1', tool: 'gerar_curriculo', decisao: 'confirmar', concluidaEm: quando },
          { callId: 'c1', tool: 'gerar_curriculo', decisao: 'recusar', concluidaEm: quando },
        ],
        criadoEm: quando,
        atualizadoEm: quando,
      },
      { _id: ids.conversaOrfa, usuarioId: usuario.id, modo: 'assistido', oportunidadeId: null, mensagens: [{ papel: 'sistema', conteudo: 'x' }], pendencia: null, criadoEm: quando, atualizadoEm: quando },
    ],
  };
  const lote = await prisma.lote.create({ data: { usuarioId: usuario.id, tipo: 'INGESTAO', total: 2 } });
  await prisma.$executeRawUnsafe(`INSERT INTO lote_itens (id, lote_id, referencia_legada) VALUES ('${id()}', '${lote.id}', '${ids.docNota}'), ('${id()}', '${lote.id}', 'documento-sumido')`);
  const loteBanco = await prisma.lote.create({ data: { usuarioId: usuario.id, tipo: 'IMPORTACAO', total: 1 } });
  await prisma.$executeRawUnsafe(`INSERT INTO lote_itens (id, lote_id, referencia_legada) VALUES ('${id()}', '${loteBanco.id}', '${ids.banco}')`);

  const indexados = [];
  const rag = { modeloAtual: async () => 'modelo-teste', indexar: async (doc) => { if (doc.usuarioId === usuario.id) indexados.push(doc.id); return 1; } };

  const primeira = await migrar(prisma, mongoFalso(colecoes), rag);
  assert.deepEqual(primeira.antes.mongo, { notas_obsidian: 2, banco_vagas: 1, documentos_rag: 3, copiloto_conversas: 2 });
  assert.deepEqual(primeira.migrados, { notas_obsidian: 1, banco_vagas: 1, documentos_rag: 2, copiloto_conversas: 1 });
  assert.deepEqual(primeira.naoMigrados.map((n) => [n.colecao, n.id]).sort(), [
    ['copiloto_conversas', ids.conversaOrfa],
    ['documentos_rag', ids.docCand],
    ['notas_obsidian', ids.notaOrfa],
  ].sort());
  assert.ok(primeira.avisos.some((a) => a.id === ids.banco && /vaga-apagada/.test(a.aviso)));
  assert.ok(primeira.avisos.some((a) => a.id === ids.docPerfil && /tipo formacao/.test(a.aviso)));
  assert.deepEqual(indexados.sort(), [ids.docNota, ids.docPerfil].sort());

  const nota = await prisma.documentoRag.findUnique({ where: { id: ids.docNota } });
  assert.equal(nota.notaId, ids.nota);
  assert.equal(nota.factual, true);
  const perfil = await prisma.documentoRag.findUnique({ where: { id: ids.docPerfil } });
  assert.equal(perfil.tipo, 'formacao');
  assert.equal(perfil.factual, true);
  const banco = await prisma.bancoVaga.findUnique({ where: { id: ids.banco } });
  assert.equal(banco.vagaId, null);
  assert.equal(banco.status, 'ATIVADA');
  assert.deepEqual(banco.keywords, [{ termo: 'SQL', peso: 3 }]);

  const conversa = await prisma.copilotoConversa.findUnique({ where: { id: ids.conversa }, include: { mensagens: { orderBy: { ordem: 'asc' } }, confirmacoes: true } });
  assert.equal(conversa.totalMensagens, 3);
  assert.equal(conversa.oportunidadeId, vaga.id);
  assert.deepEqual(conversa.resumo, { texto: 'resumo', ate: 1 });
  assert.deepEqual(conversa.mensagens.map((m) => [m.ordem, m.papel, m.tool]), [[0, 'user', null], [1, 'assistant', null], [2, 'tool', 'gerar_curriculo']]);
  assert.deepEqual(conversa.mensagens[2].dados.resultado, { jobId: 'job-1' });
  assert.deepEqual(conversa.confirmacoes.map((c) => c.decisao), ['confirmar']);
  assert.equal(conversa.criadoEm.toISOString(), quando.toISOString());

  const itens = await prisma.loteItem.findMany({ where: { loteId: { in: [lote.id, loteBanco.id] } } });
  assert.deepEqual(itens.map((i) => [i.referenciaLegada, i.documentoRagId, i.bancoVagaId]).sort(), [
    ['documento-sumido', null, null],
    [ids.banco, null, ids.banco],
    [ids.docNota, ids.docNota, null],
  ].sort());

  const segunda = await migrar(prisma, mongoFalso(colecoes), null);
  assert.deepEqual(segunda.migrados, { notas_obsidian: 0, banco_vagas: 0, documentos_rag: 0, copiloto_conversas: 0 });
  assert.deepEqual(segunda.jaExistentes, { notas_obsidian: 1, banco_vagas: 1, documentos_rag: 2, copiloto_conversas: 1 });
  assert.equal(await prisma.copilotoMensagem.count({ where: { conversaId: ids.conversa } }), 3);
  assert.deepEqual(segunda.reindexacao, { pulada: 'executado com --sem-reindexar' });
});
