const assert = require('node:assert/strict');
const test = require('node:test');
const { turnoTexto, turnoTool } = require('./helpers/turnos');
const { ChatService } = require('../dist/copiloto/chat.service');

const EMAIL = 'pessoa.privada@exemplo.dev';
const TELEFONE = '+55 85 99999-1234';

async function enviadoAoLlmDepoisDeLerPerfil(perfil) {
  const conversa = {
    _id: 'conversa-1',
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
    copilotoTurn: async (payload) => {
      enviadosAoLlm.push(JSON.stringify(payload.trocas));
      return turnos.shift();
    },
  };
  const executor = { executar: async () => perfil };
  const res = { setHeader() {}, flushHeaders() {}, write() {}, end() {} };

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
