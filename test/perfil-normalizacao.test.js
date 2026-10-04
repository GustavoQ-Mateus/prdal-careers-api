require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const {
  normalizarPerfil,
  perfilParaPersistencia,
  perfilParaIa,
  lerPeriodoTexto,
} = require('../dist/perfil/perfil.normalizacao');
const { PerfilMestreDto } = require('../dist/perfil/perfil.dto');
const { PerfilService } = require('../dist/perfil/perfil.service');

const PERFIL_LISTA = {
  id: 'perfil-1',
  usuarioId: 'usuario-1',
  nome: 'Pessoa Exemplo',
  contato: [
    { id: 'c1', tipo: 'email', valor: 'pessoa@exemplo.dev' },
    { id: 'c2', tipo: 'email', valor: 'outra@exemplo.dev' },
    { id: 'c3', tipo: 'telefone', valor: '+55 (85) 90000-0001' },
    { id: 'c4', tipo: 'linkedin', valor: 'linkedin.com/in/pessoa-exemplo' },
    { id: 'c5', tipo: 'github', valor: 'github.com/pessoa-exemplo' },
    { id: 'c6', tipo: 'site', valor: 'pessoa.exemplo.dev' },
    { id: 'c7', tipo: 'localizacao', valor: 'Fortaleza - CE' },
    { id: 'c8', tipo: 'outro', rotulo: 'WhatsApp', valor: '85 90000-0002' },
  ],
  resumo: 'Back-end com Python.',
  experiencias: [
    {
      id: 'e1',
      cargo: 'Desenvolvedor',
      empresa: 'Empresa A',
      periodo: 'Jun. 2024 a atual',
      local: 'Fortaleza, CE',
      descricao: '- Atuei com Python e FastAPI.\n- Mantive APIs REST.',
      tecnologias: ['Python', 'FastAPI'],
    },
    {
      id: 'e2',
      cargo: 'Estagiario',
      empresa: 'Empresa B',
      periodo: '01/2022 - 12/2023',
      local: 'Remoto',
      descricao: 'Suporte a sistemas internos.',
    },
    {
      id: 'e3',
      cargo: 'Monitor',
      empresa: 'Escola C',
      periodo: 'verao de 2019',
      descricao: 'Monitoria de logica.',
    },
  ],
  formacao: ['Universidade A | ADS | 02/2023 - 12/2025'],
  certificacoes: ['Python, Escola A, 2025'],
  idiomas: ['Portugues, nativo'],
  skills: ['Python', 'FastAPI'],
  atualizadoEm: new Date('2026-09-01T00:00:00Z'),
};

const PERFIL_MAPA = {
  nome: 'Outra Pessoa',
  contato: {
    email: 'outra.pessoa@exemplo.dev',
    telefone: '(11) 3000-0000',
    cidade: 'Sao Paulo/SP',
    portfolio: 'portfolio.exemplo.dev',
    Skype: 'outra.pessoa.exemplo',
  },
  resumo: '',
  experiencias: ['Empresa D | Analista | 03/2020 - 05/2021 | Analise de dados com SQL'],
  formacao: ['Bacharelado em Fisica, Universidade B'],
  certificacoes: [],
  idiomas: [],
  skills: ['SQL'],
};

const PERFIL_SEM_LOCAL = {
  nome: 'Terceira Pessoa',
  contato: [{ id: 'x', tipo: 'localizacao', valor: 'Remoto, qualquer lugar do mundo' }],
  resumo: '',
  experiencias: [],
  formacao: [],
  skills: [],
};

const ANTIGOS = [PERFIL_LISTA, PERFIL_MAPA, PERFIL_SEM_LOCAL];

function viaBanco(perfil) {
  const persistido = JSON.parse(JSON.stringify(perfilParaPersistencia(normalizarPerfil(perfil))));
  return normalizarPerfil(persistido);
}

test('perfil antigo vira o formato novo com principal e contato tipado', () => {
  const perfil = normalizarPerfil(PERFIL_LISTA);
  assert.equal(perfil.contato, undefined);
  assert.deepEqual(perfil.emails, [
    { id: 'contato-legado-1', valor: 'pessoa@exemplo.dev', principal: true },
    { id: 'contato-legado-2', valor: 'outra@exemplo.dev', principal: false },
  ]);
  assert.deepEqual(perfil.telefones, [{ id: 'contato-legado-3', ddi: '+55', numero: '(85) 90000-0001', principal: true }]);
  assert.deepEqual(perfil.links.map((link) => [link.tipo, link.url]), [
    ['linkedin', 'linkedin.com/in/pessoa-exemplo'],
    ['github', 'github.com/pessoa-exemplo'],
    ['site', 'pessoa.exemplo.dev'],
  ]);
  assert.deepEqual(perfil.endereco, { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' });
  assert.deepEqual(perfil.outrosContatos, [
    { id: 'contato-legado-8', rotulo: 'WhatsApp', valor: '85 90000-0002', revisao: ['contato_sem_tipo'] },
  ]);
  assert.equal(perfil.id, 'perfil-1');
  assert.equal(perfil.usuarioId, 'usuario-1');
});

test('experiencia antiga ganha datas estruturadas e preserva texto que nao parseia', () => {
  const [atual, encerrada, livre] = normalizarPerfil(PERFIL_LISTA).experiencias;
  assert.deepEqual(
    [atual.dataInicioMes, atual.dataInicioAno, atual.dataFimMes, atual.dataFimAno, atual.atual],
    [6, 2024, null, null, true],
  );
  assert.deepEqual(atual.local, { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' });
  assert.equal(atual.tecnologias, undefined);
  assert.equal(atual.descricao, '- Atuei com Python e FastAPI.\n- Mantive APIs REST.\nTecnologias: Python, FastAPI');
  assert.deepEqual(atual.revisao, ['tecnologias_na_descricao']);
  assert.equal(atual.periodoLegado, undefined);

  assert.deepEqual(
    [encerrada.dataInicioMes, encerrada.dataInicioAno, encerrada.dataFimMes, encerrada.dataFimAno, encerrada.atual],
    [1, 2022, 12, 2023, false],
  );
  assert.equal(encerrada.local, null);
  assert.equal(encerrada.localLegado, 'Remoto');
  assert.deepEqual(encerrada.revisao, ['local_texto']);

  assert.equal(livre.periodoLegado, 'verao de 2019');
  assert.equal(livre.dataInicioAno, null);
  assert.deepEqual(livre.revisao, ['periodo_texto']);
});

test('formacao e certificacao em texto viram objeto com a linha inteira e marca de revisao', () => {
  const perfil = normalizarPerfil(PERFIL_LISTA);
  assert.deepEqual(perfil.formacao, [{
    id: 'formacao-legado-1',
    grau: '',
    status: '',
    instituicao: '',
    curso: 'Universidade A | ADS | 02/2023 - 12/2025',
    inicioMes: null,
    inicioAno: null,
    fimMes: null,
    fimAno: null,
    revisao: ['formato_antigo'],
  }]);
  assert.deepEqual(perfil.certificacoes, [
    { id: 'certificacao-legado-1', titulo: 'Python, Escola A, 2025', descricao: '', revisao: ['formato_antigo'] },
  ]);
});

test('contato em mapa antigo e experiencia em linha tambem convertem', () => {
  const perfil = normalizarPerfil(PERFIL_MAPA);
  assert.deepEqual(perfil.emails.map((email) => [email.valor, email.principal]), [['outra.pessoa@exemplo.dev', true]]);
  assert.deepEqual(perfil.telefones, [
    { id: 'contato-legado-2', ddi: '', numero: '(11) 3000-0000', principal: true, revisao: ['ddi_ausente'] },
  ]);
  assert.deepEqual(perfil.endereco, { pais: 'Brasil', estado: 'SP', cidade: 'Sao Paulo' });
  assert.deepEqual(perfil.links, [{ id: 'contato-legado-4', tipo: 'site', url: 'portfolio.exemplo.dev' }]);
  assert.deepEqual(perfil.outrosContatos, [
    { id: 'contato-legado-5', rotulo: 'Skype', valor: 'outra.pessoa.exemplo', revisao: ['contato_sem_tipo'] },
  ]);
  const [experiencia] = perfil.experiencias;
  assert.deepEqual(
    [experiencia.empresa, experiencia.cargo, experiencia.dataInicioMes, experiencia.dataInicioAno, experiencia.dataFimMes, experiencia.dataFimAno],
    ['Empresa D', 'Analista', 3, 2020, 5, 2021],
  );
  assert.equal(experiencia.descricao, 'Analise de dados com SQL');
});

test('localizacao que nao parseia fica preservada no endereco com marca de revisao', () => {
  assert.deepEqual(normalizarPerfil(PERFIL_SEM_LOCAL).endereco, {
    pais: '',
    estado: '',
    cidade: '',
    legado: 'Remoto, qualquer lugar do mundo',
    revisao: ['localizacao_texto'],
  });
});

const PRESERVADOS = new Map([
  [PERFIL_LISTA, [
    'pessoa@exemplo.dev', 'outra@exemplo.dev', '(85) 90000-0001', 'linkedin.com/in/pessoa-exemplo',
    'github.com/pessoa-exemplo', 'pessoa.exemplo.dev', 'Fortaleza', 'WhatsApp', '85 90000-0002',
    'Back-end com Python.', 'Atuei com Python e FastAPI.', 'Mantive APIs REST.', 'Tecnologias: Python, FastAPI',
    'Remoto', 'verao de 2019', 'Monitoria de logica.', 'Suporte a sistemas internos.',
    'Universidade A | ADS | 02/2023 - 12/2025', 'Python, Escola A, 2025', 'Portugues, nativo',
  ]],
  [PERFIL_MAPA, [
    'outra.pessoa@exemplo.dev', '(11) 3000-0000', 'Sao Paulo', 'portfolio.exemplo.dev', 'Skype',
    'outra.pessoa.exemplo', 'Empresa D', 'Analista', 'Analise de dados com SQL', 'Bacharelado em Fisica, Universidade B',
  ]],
  [PERFIL_SEM_LOCAL, ['Remoto, qualquer lugar do mundo']],
]);

test('nenhum texto do perfil antigo some na normalizacao nem vira [object Object]', () => {
  for (const [antigo, preservados] of PRESERVADOS) {
    const serializado = JSON.stringify(viaBanco(antigo));
    assert.doesNotMatch(serializado, /\[object Object\]/);
    for (const texto of preservados) assert.ok(serializado.includes(JSON.stringify(texto).slice(1, -1)), `texto perdido: ${texto}`);
    assert.doesNotMatch(JSON.stringify(perfilParaIa(antigo)), /\[object Object\]/);
  }
});

test('normalizar duas vezes da o mesmo resultado, inclusive passando pelo banco', () => {
  for (const antigo of ANTIGOS) {
    const uma = normalizarPerfil(antigo);
    assert.deepEqual(normalizarPerfil(uma), uma);
    const banco = viaBanco(antigo);
    assert.deepEqual(viaBanco(banco), banco);
    const { atualizadoEm, id, usuarioId, ...semMetadados } = uma;
    assert.deepEqual(JSON.parse(JSON.stringify(semMetadados)), banco);
  }
});

test('principal fica unico e experiencia atual nunca guarda data de fim', () => {
  const perfil = normalizarPerfil({
    emails: [
      { id: 'a', valor: 'a@exemplo.dev', principal: false },
      { id: 'b', valor: 'b@exemplo.dev', principal: true },
      { id: 'c', valor: 'c@exemplo.dev', principal: true },
    ],
    telefones: [{ id: 't', ddi: '55', numero: '85 90000-0003', principal: false }],
    links: [],
    endereco: null,
    experiencias: [{ id: 'e', cargo: 'Dev', empresa: 'X', descricao: 'Fatos', dataInicioMes: 1, dataInicioAno: 2024, dataFimMes: 3, dataFimAno: 2025, atual: true, local: null }],
  });
  assert.deepEqual(perfil.emails.map((email) => email.principal), [false, true, false]);
  assert.deepEqual(perfil.telefones, [{ id: 't', ddi: '+55', numero: '85 90000-0003', principal: true }]);
  assert.deepEqual([perfil.experiencias[0].dataFimMes, perfil.experiencias[0].dataFimAno], [null, null]);
});

test('leitura de periodo em texto cobre os formatos comuns e marca o que sobra', () => {
  const casos = [
    ['01/2020 - 12/2021', [1, 2020, 12, 2021, false, true]],
    ['Jan 2020 a Dez 2022', [1, 2020, 12, 2022, false, true]],
    ['marco de 2021 ate o momento', [3, 2021, null, null, true, true]],
    ['2019 - 2021', [null, 2019, null, 2021, false, false]],
    ['01/2020 - 12/2021 (contrato temporario)', [1, 2020, 12, 2021, false, false]],
    ['12/2022 - 01/2020', [12, 2022, 1, 2020, false, false]],
  ];
  for (const [entrada, esperado] of casos) {
    const lido = lerPeriodoTexto(entrada);
    assert.deepEqual(
      [lido.inicio?.mes ?? null, lido.inicio?.ano ?? null, lido.fim?.mes ?? null, lido.fim?.ano ?? null, lido.atual, lido.completo],
      esperado,
      entrada,
    );
  }
});

function validar(corpo) {
  return validateSync(plainToInstance(PerfilMestreDto, corpo), { whitelist: true });
}

const CORPO_VALIDO = {
  nome: 'Pessoa',
  emails: [{ id: 'e1', valor: 'pessoa@exemplo.dev', principal: true }],
  telefones: [{ id: 't1', ddi: '+55', numero: '85 90000-0001', principal: true }],
  links: [{ id: 'l1', tipo: 'instagram', url: 'instagram.com/pessoa' }],
  endereco: { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza', bairro: 'Centro' },
  resumo: '',
  experiencias: [{ id: 'x1', cargo: 'Dev', empresa: 'A', dataInicioMes: 1, dataInicioAno: 2024, atual: true, local: { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' }, descricao: 'Fatos' }],
  formacao: [{ id: 'f1', grau: 'Tecnologo', status: 'em_andamento', instituicao: 'U', curso: 'ADS', inicioMes: 2, inicioAno: 2023 }],
  certificacoes: [{ id: 'k1', titulo: 'Python', descricao: 'Escola A' }],
  skills: [],
};

test('dto aceita o formato novo e valida sigla de estado no Brasil', () => {
  assert.deepEqual(validar(CORPO_VALIDO), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, endereco: { pais: 'Brasil', estado: 'Ceara', cidade: 'Fortaleza' } }), []);
  assert.deepEqual(validar({ ...CORPO_VALIDO, endereco: { pais: 'Portugal', estado: 'Lisboa', cidade: 'Lisboa' } }), []);
  const localInvalido = { ...CORPO_VALIDO.experiencias[0], local: { pais: 'Brasil', estado: 'ceara', cidade: 'X' } };
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, experiencias: [localInvalido] }), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, links: [{ id: 'l', tipo: 'tiktok', url: 'x' }] }), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, telefones: [{ id: 't', ddi: '55 85', numero: '1', principal: true }] }), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, formacao: [{ ...CORPO_VALIDO.formacao[0], status: 'pausado' }] }), []);
});

test('dto aceita texto legado em periodo, local e endereco e limita o tamanho', () => {
  const legado = { ...CORPO_VALIDO.experiencias[0], dataInicioMes: null, dataInicioAno: null, atual: false, periodo: 'Jan 2024 a atual', local: 'Fortaleza, CE' };
  assert.deepEqual(validar({ ...CORPO_VALIDO, endereco: 'Fortaleza - CE', experiencias: [legado] }), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, endereco: 'x'.repeat(501) }), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, experiencias: [{ ...legado, local: 'x'.repeat(501) }] }), []);
  assert.notDeepEqual(validar({ ...CORPO_VALIDO, endereco: 42 }), []);
});

test('perfil antigo normalizado volta pela validacao do dto sem erro, inclusive experiencia sem descricao', () => {
  for (const antigo of [...ANTIGOS, { ...PERFIL_MAPA, experiencias: [{ cargo: 'Dev', empresa: 'A', periodo: '2020' }] }]) {
    const corpo = JSON.parse(JSON.stringify(normalizarPerfil(antigo)));
    assert.deepEqual(validar(corpo), [], JSON.stringify(corpo.experiencias));
  }
});

test('salvar normaliza na escrita e grava o contato tipado na coluna json', async () => {
  let gravado = null;
  const prisma = {
    perfilMestre: {
      upsert: async ({ create }) => {
        gravado = create;
        return { id: 'p', ...create };
      },
    },
  };
  const corpo = plainToInstance(PerfilMestreDto, {
    ...CORPO_VALIDO,
    endereco: 'Fortaleza - CE',
    experiencias: [{ id: 'x1', cargo: 'Dev', empresa: 'A', periodo: 'Jan 2024 a atual', local: 'Remoto', descricao: 'Fatos' }],
  });
  const salvo = await new PerfilService(prisma).salvar('usuario-1', corpo);
  assert.deepEqual(Object.keys(gravado.contato).sort(), ['emails', 'endereco', 'links', 'outrosContatos', 'telefones']);
  assert.deepEqual(gravado.contato.endereco, { pais: 'Brasil', estado: 'CE', cidade: 'Fortaleza' });
  const [experiencia] = gravado.experiencias;
  assert.deepEqual([experiencia.dataInicioMes, experiencia.dataInicioAno, experiencia.atual], [1, 2024, true]);
  assert.equal(experiencia.periodo, undefined);
  assert.equal(experiencia.localLegado, 'Remoto');
  assert.deepEqual(salvo.endereco, gravado.contato.endereco);
  assert.equal(salvo.contato, undefined);
});

test('lista em texto ou item em formato desconhecido nao some na normalizacao', () => {
  const perfil = normalizarPerfil({
    nome: 'Pessoa',
    certificacoes: 'AWS SAA',
    skills: 'Java, Go',
    idiomas: 'Inglês',
    formacao: 'Bacharel X',
  });
  assert.deepEqual(
    perfil.certificacoes,
    [{ id: 'certificacao-legado-1', titulo: 'AWS SAA', descricao: '', revisao: ['formato_antigo'] }],
  );
  assert.deepEqual(perfil.skills, ['Java, Go']);
  assert.deepEqual(perfil.idiomas, ['Inglês']);
  assert.deepEqual(perfil.formacao.map(({ id, curso, revisao }) => ({ id, curso, revisao })), [
    { id: 'formacao-legado-1', curso: 'Bacharel X', revisao: ['formato_antigo'] },
  ]);

  const emLinhas = normalizarPerfil({ skills: 'Java\nGo\n', idiomas: 'Inglês\r\nEspanhol', certificacoes: 'AWS\nCKA' });
  assert.deepEqual(emLinhas.skills, ['Java', 'Go']);
  assert.deepEqual(emLinhas.idiomas, ['Inglês', 'Espanhol']);
  assert.deepEqual(emLinhas.certificacoes.map((item) => item.titulo), ['AWS', 'CKA']);

  const objetos = normalizarPerfil({
    certificacoes: [{ nome: 'AWS', ano: 2024, ativa: true }],
    formacao: [{ escola: 'Universidade A', titulo: 'Bacharel X' }],
  });
  assert.deepEqual(
    objetos.certificacoes,
    [{ id: 'certificacao-legado-1', titulo: 'AWS, 2024', descricao: '', revisao: ['formato_antigo'] }],
  );
  assert.deepEqual(
    objetos.formacao.map(({ curso, revisao }) => ({ curso, revisao })),
    [{ curso: 'Universidade A, Bacharel X', revisao: ['formato_antigo'] }],
  );

  const salvo = JSON.parse(JSON.stringify(perfilParaPersistencia(objetos)));
  assert.deepEqual(normalizarPerfil(salvo).certificacoes, objetos.certificacoes);
  assert.deepEqual(normalizarPerfil(salvo).formacao, objetos.formacao);
});

test('email com varios enderecos vira itens separados e valor sem forma de email ganha marca', () => {
  for (const separador of [', ', '; ', ' ', ',']) {
    const perfil = normalizarPerfil({ contato: [{ tipo: 'email', valor: `a@x.dev${separador}b@x.dev` }] });
    assert.deepEqual(
      perfil.emails.map(({ valor, principal, revisao }) => ({ valor, principal, revisao })),
      [
        { valor: 'a@x.dev', principal: true, revisao: undefined },
        { valor: 'b@x.dev', principal: false, revisao: undefined },
      ],
      separador,
    );
    assert.equal(new Set(perfil.emails.map((email) => email.id)).size, 2);
  }

  const invalido = normalizarPerfil({
    emails: [
      { id: 'e1', valor: 'nao-e-email', principal: true },
      { id: 'e2', valor: 'pessoa@x.dev', principal: false },
    ],
  });
  assert.deepEqual(invalido.emails, [
    { id: 'e1', valor: 'nao-e-email', principal: false, revisao: ['email_invalido'] },
    { id: 'e2', valor: 'pessoa@x.dev', principal: true },
  ]);
  assert.deepEqual(perfilParaIa(invalido).emails.find((email) => email.principal).valor, 'pessoa@x.dev');

  const soInvalido = normalizarPerfil({ contato: [{ tipo: 'email', valor: 'nao-e-email' }] });
  assert.deepEqual(soInvalido.emails.map(({ principal, revisao }) => ({ principal, revisao })), [
    { principal: true, revisao: ['email_invalido'] },
  ]);

  const misto = normalizarPerfil({ emails: [{ id: 'e', valor: 'a@x.dev, nao-e-email', principal: true }] });
  assert.deepEqual(misto.emails.map(({ valor, revisao }) => ({ valor, revisao })), [
    { valor: 'a@x.dev, nao-e-email', revisao: ['email_invalido'] },
  ]);

  const corrigido = normalizarPerfil({ emails: [{ id: 'e', valor: 'a@x.dev', principal: true, revisao: ['email_invalido'] }] });
  assert.deepEqual(corrigido.emails, [{ id: 'e', valor: 'a@x.dev', principal: true }]);

  const salvo = JSON.parse(JSON.stringify(perfilParaPersistencia(invalido)));
  assert.deepEqual(normalizarPerfil(salvo).emails, invalido.emails);
  assert.deepEqual(validar(JSON.parse(JSON.stringify(invalido))), []);
});

test('periodo com nome do mes e barra e periodo com mes invalido', () => {
  const comBarra = lerPeriodoTexto('Março/2020 a Dez/2021');
  assert.deepEqual(
    [comBarra.inicio, comBarra.fim, comBarra.atual, comBarra.completo],
    [{ mes: 3, ano: 2020 }, { mes: 12, ano: 2021 }, false, true],
  );
  assert.equal(lerPeriodoTexto('jan / 2022 - atual').completo, true);

  const experiencia = (periodo) => normalizarPerfil({ experiencias: [{ cargo: 'Dev', empresa: 'A', periodo }] }).experiencias[0];
  const valida = experiencia('Março/2020 a Dez/2021');
  assert.deepEqual(
    [valida.dataInicioMes, valida.dataInicioAno, valida.dataFimMes, valida.dataFimAno, valida.periodoLegado, valida.revisao],
    [3, 2020, 12, 2021, undefined, undefined],
  );

  for (const periodo of ['13/2020 - 01/2021', '01/2020 - 00/2021', '13/2020 ate o momento']) {
    const lido = lerPeriodoTexto(periodo);
    assert.deepEqual([lido.inicio, lido.fim, lido.atual, lido.completo], [null, null, false, false], periodo);
    const invalida = experiencia(periodo);
    assert.deepEqual(
      [invalida.dataInicioMes, invalida.dataInicioAno, invalida.dataFimMes, invalida.dataFimAno, invalida.atual],
      [null, null, null, null, false],
      periodo,
    );
    assert.equal(invalida.periodoLegado, periodo);
    assert.deepEqual(invalida.revisao, ['periodo_texto']);
  }
});
