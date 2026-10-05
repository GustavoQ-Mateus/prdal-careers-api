let sequencia = 0;

function turnoTool(name, input = {}, id = `toolu_teste_${++sequencia}`) {
  return { conteudo: [{ type: 'tool_use', id, name, input }], parada: 'tool_use' };
}

function turnoTexto(text) {
  return { conteudo: [{ type: 'text', text }], parada: 'end_turn' };
}

module.exports = { turnoTool, turnoTexto };

function mensagensEnviadas(payload) {
  return payload.trocas.flatMap((troca) => troca.mensagens);
}

module.exports.mensagensEnviadas = mensagensEnviadas;

function turnosEmMemoria(travas = new Map()) {
  const { ConflictException } = require('@nestjs/common');
  const { MENSAGEM_TURNO_EM_ANDAMENTO } = require('../../dist/copiloto/turnos.service');
  let sequencia = 0;
  return {
    travas,
    async exigir(conversaId) {
      if (travas.has(conversaId)) throw new ConflictException({ message: MENSAGEM_TURNO_EM_ANDAMENTO, codigo: 'turno_em_andamento' });
      const turno = { conversaId, turnoId: `turno-${++sequencia}` };
      travas.set(conversaId, turno.turnoId);
      return turno;
    },
    manter(turno) {
      return async () => {
        if (travas.get(turno.conversaId) === turno.turnoId) travas.delete(turno.conversaId);
      };
    },
  };
}

module.exports.turnosEmMemoria = turnosEmMemoria;
