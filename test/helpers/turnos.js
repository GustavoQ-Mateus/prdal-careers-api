let sequencia = 0;

function turnoTool(name, input = {}, id = `toolu_teste_${++sequencia}`) {
  return { conteudo: [{ type: 'tool_use', id, name, input }], parada: 'tool_use' };
}

function turnoTexto(text) {
  return { conteudo: [{ type: 'text', text }], parada: 'end_turn' };
}

module.exports = { turnoTool, turnoTexto };
