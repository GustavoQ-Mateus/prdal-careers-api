const assert = require('node:assert/strict');
const test = require('node:test');
const { narracaoAts } = require('../dist/curriculos/curriculos.service');

test('narracao rotula aderencia sem afirmar melhora entre artefatos do sistema', () => {
  const inicial = {
    score: 48,
    keywordsEncontradas: ['TypeScript'],
    keywordsCriticasAusentes: ['Docker'],
    pontosEliminatorios: [],
    veredicto: 'Cobertura baixa das keywords da vaga.',
  };
  const texto = narracaoAts(inicial, { ...inicial, score: 76, keywordsCriticasAusentes: [] });

  assert.match(texto, /Etapa 1: Aderência do perfil-mestre/);
  assert.match(texto, /Etapa 3: Aderência do currículo gerado/);
  assert.match(texto, /Score: 76\. Para referência, a aderência do perfil-mestre foi 48\./);
  assert.match(texto, /\[\[NARRACAO_ATS_ETAPA_3\]\]/);
  for (const proibida of ['aumentou', 'melhorou', 'reduziu', '—']) {
    assert.ok(!texto.includes(proibida), proibida);
  }
});
