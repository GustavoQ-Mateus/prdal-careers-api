const assert = require('node:assert/strict');
const test = require('node:test');
const { ServiceUnavailableException } = require('@nestjs/common');
const { AxiosError } = require('axios');
const { CapacidadesService, MENSAGEM_IA_INDISPONIVEL } = require('../dist/copiloto/capacidades.service');

function erroAxios(status) {
  const resposta = status ? { status, data: { detail: 'detalhe tecnico' }, headers: {}, config: {}, statusText: '' } : undefined;
  return new AxiosError('falhou', status ? 'ERR_BAD_RESPONSE' : 'ECONNREFUSED', {}, {}, resposta);
}

function servico(erro) {
  const falhar = async () => { throw erro; };
  const ai = { redigirMensagem: falhar, redigirFormulario: falhar, score: falhar, contextQuery: falhar };
  const oportunidades = { buscar: async () => ({ id: 'vaga-1', titulo: 'Vaga', keywordsStatus: 'VALIDAS', keywords: [] }) };
  const perfil = { buscar: async () => null };
  return new CapacidadesService(ai, oportunidades, perfil);
}

test('503 do ai-service na mensagem ao recrutador vira 503 com frase de produto', async () => {
  await assert.rejects(
    servico(erroAxios(503)).mensagemRecrutador('usuario-1', 'vaga-1'),
    (err) => err instanceof ServiceUnavailableException && err.message === MENSAGEM_IA_INDISPONIVEL,
  );
});

test('ai-service fora do ar nas respostas de formulario vira 503', async () => {
  await assert.rejects(
    servico(erroAxios()).respostasFormulario('usuario-1', 'vaga-1', ['Campo']),
    (err) => err instanceof ServiceUnavailableException,
  );
});

test('erro que nao e indisponibilidade continua propagando', async () => {
  const erro = erroAxios(422);
  await assert.rejects(servico(erro).score('usuario-1', '# CV', undefined, [{ termo: 'Java', peso: 1 }]), (err) => err === erro);
});
