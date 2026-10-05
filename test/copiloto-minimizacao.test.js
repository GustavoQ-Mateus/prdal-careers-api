const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');

const EMAIL = 'pessoa.privada@exemplo.dev';
const TELEFONE = '+55 85 99999-1234';

async function enviadoAoLlmDepoisDeLerPerfil(perfil) {
  const conversa = {
    id: 'conversa-1',
    usuarioId: 'usuario-1',
    modo: 'assistido',
    oportunidadeId: null,
    mensagens: [],
    pendencia: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };
  const conversas = {
    abrir: async () => conversa,
    anexar: async (_id, mensagem) => conversa.mensagens.push(mensagem),
    definirPendencia: async () => {},
  };
  const enviadosAoLlm = [];
  const turnos = [
    turnoTool('ler_perfil'),
    turnoTexto('Li seu perfil.'),
  ];
  const ai = {
    copilotoTurnStream: async (payload) => {
      enviadosAoLlm.push(JSON.stringify(payload.trocas));
      return turnos.shift();
    },
  };
  const executor = { executar: async () => perfil };
  const res = { setHeader() {}, flushHeaders() {}, on() {}, write() {}, end() {} };

  await new ChatService(conversas, ai, executor).chat(res, { userId: 'usuario-1' }, { mensagem: 'leia meu perfil' });

  assert.equal(enviadosAoLlm.length, 2);
  return enviadosAoLlm[1];
}

test('ler_perfil chega ao LLM sem o contato do candidato no formato antigo', async () => {
  const segundoTurno = await enviadoAoLlmDepoisDeLerPerfil({
    nome: 'Pessoa Candidata',
    contato: [{ id: 'c1', tipo: 'email', valor: EMAIL }, { id: 'c2', tipo: 'telefone', valor: TELEFONE }],
    resumo: 'Back-end com Python.',
    skills: ['Python'],
  });
  assert.match(segundoTurno, /Pessoa Candidata/);
  assert.match(segundoTurno, /Back-end com Python/);
  assert.doesNotMatch(segundoTurno, /pessoa\.privada@exemplo\.dev/);
  assert.doesNotMatch(segundoTurno, /99999-1234/);
});

test('ler_perfil chega ao LLM sem nenhum campo de contato do formato novo', async () => {
  const segundoTurno = await enviadoAoLlmDepoisDeLerPerfil({
    nome: 'Pessoa Candidata',
    emails: [{ id: 'e1', valor: EMAIL, principal: true }],
    telefones: [{ id: 't1', ddi: '+55', numero: '85 99999-1234', principal: true }],
    links: [{ id: 'l1', tipo: 'linkedin', url: 'linkedin.com/in/pessoa-privada' }],
    endereco: { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza', logradouro: 'Rua Privada, 123' },
    outrosContatos: [{ id: 'o1', rotulo: 'WhatsApp', valor: '85 98888-0000' }],
    resumo: 'Back-end com Python.',
    skills: ['Python'],
  });
  assert.match(segundoTurno, /Pessoa Candidata/);
  assert.match(segundoTurno, /Back-end com Python/);
  for (const privado of [/pessoa\.privada@exemplo\.dev/, /99999-1234/, /pessoa-privada/, /Rua Privada/, /98888-0000/, /Fortaleza/]) {
    assert.doesNotMatch(segundoTurno, privado);
  }
});

async function gravadoDepoisDaTool(tool, resultado) {
  const conversa = { id: 'conversa-2', usuarioId: 'usuario-1', modo: 'assistido', oportunidadeId: null, mensagens: [], pendencia: null };
  const conversas = {
    abrir: async () => conversa,
    anexar: async (_id, mensagem) => conversa.mensagens.push(mensagem),
    definirPendencia: async () => {},
  };
  const turnos = [turnoTool(tool, tool === 'buscar_curriculo' ? { curriculoId: 'cv-1' } : {}), turnoTexto('Pronto.')];
  const ai = { copilotoTurnStream: async () => turnos.shift() };
  const executor = { executar: async () => resultado };
  const res = { setHeader() {}, flushHeaders() {}, on() {}, write() {}, end() {} };
  await new ChatService(conversas, ai, executor).chat(res, { userId: 'usuario-1' }, { mensagem: 'faca' });
  return conversa.mensagens.find((m) => m.papel === 'tool');
}

test('o historico grava o resultado resumido, nunca o resultado bruto da tool', async () => {
  const perfil = await gravadoDepoisDaTool('ler_perfil', {
    nome: 'Pessoa Candidata',
    emails: [{ id: 'e1', valor: EMAIL, principal: true }],
    resumo: 'x'.repeat(5000),
  });
  assert.equal(perfil.dados.ok, true);
  assert.doesNotMatch(JSON.stringify(perfil.dados.resultado), /pessoa\.privada@exemplo\.dev/);
  assert.equal(perfil.dados.resultado.resumo.length, 5000);

  const curriculo = await gravadoDepoisDaTool('buscar_curriculo', {
    id: 'cv-1',
    markdown: '# CV',
    score: 80,
    estrutura: { secoes: Array.from({ length: 200 }, (_, i) => ({ titulo: `s${i}`, texto: 'y'.repeat(100) })) },
    docxPath: '/storage/cv-1.docx',
  });
  assert.deepEqual(Object.keys(curriculo.dados.resultado).sort(), ['id', 'markdown', 'score']);
  assert.equal(JSON.stringify(curriculo.dados.resultado), curriculo.conteudo);
});
