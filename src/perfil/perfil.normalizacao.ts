export const TIPOS_CONTATO_LEGADO = [
  'email',
  'telefone',
  'linkedin',
  'github',
  'site',
  'localizacao',
  'outro',
] as const;

type TipoContatoLegado = (typeof TIPOS_CONTATO_LEGADO)[number];

interface ContatoLegado {
  tipo: TipoContatoLegado;
  valor: string;
  rotulo?: string;
}

export const TIPOS_LINK = ['linkedin', 'github', 'facebook', 'instagram', 'site'] as const;
export type TipoLink = (typeof TIPOS_LINK)[number];

export const STATUS_FORMACAO = ['concluido', 'em_andamento', 'trancado'] as const;
export type StatusFormacao = (typeof STATUS_FORMACAO)[number];

export const MOTIVOS_REVISAO = [
  'formato_antigo',
  'periodo_texto',
  'local_texto',
  'tecnologias_na_descricao',
  'ddi_ausente',
  'localizacao_texto',
  'contato_sem_tipo',
  'email_invalido',
] as const;
export type MotivoRevisao = (typeof MOTIVOS_REVISAO)[number];

export const PAIS_BRASIL = 'Brasil';

export const PREFIXO_TECNOLOGIAS = 'Tecnologias: ';

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

interface Revisavel {
  revisao?: MotivoRevisao[];
}

export interface EmailPerfil extends Revisavel {
  id: string;
  valor: string;
  principal: boolean;
}

export interface TelefonePerfil extends Revisavel {
  id: string;
  ddi: string;
  numero: string;
  principal: boolean;
}

export interface LinkPerfil {
  id: string;
  tipo: TipoLink;
  url: string;
}

export interface LocalPerfil {
  pais: string;
  estado: string;
  cidade: string;
}

export interface EnderecoPerfil extends LocalPerfil, Revisavel {
  bairro?: string;
  logradouro?: string;
  complemento?: string;
  legado?: string;
}

export interface OutroContatoPerfil extends Revisavel {
  id: string;
  rotulo: string;
  valor: string;
}

export interface FormacaoPerfil extends Revisavel {
  id: string;
  grau: string;
  status: StatusFormacao | '';
  instituicao: string;
  curso: string;
  inicioMes: number | null;
  inicioAno: number | null;
  fimMes: number | null;
  fimAno: number | null;
}

export interface CertificacaoPerfil extends Revisavel {
  id: string;
  titulo: string;
  descricao: string;
}

export interface ExperienciaPerfil extends Revisavel {
  id: string;
  cargo: string;
  empresa: string;
  dataInicioMes: number | null;
  dataInicioAno: number | null;
  dataFimMes: number | null;
  dataFimAno: number | null;
  atual: boolean;
  local: LocalPerfil | null;
  descricao: string;
  periodoLegado?: string;
  localLegado?: string;
}

export interface ContatoPerfil {
  emails: EmailPerfil[];
  telefones: TelefonePerfil[];
  links: LinkPerfil[];
  endereco: EnderecoPerfil | null;
  outrosContatos: OutroContatoPerfil[];
}

export interface PerfilNormalizado extends ContatoPerfil {
  nome: string;
  resumo: string;
  experiencias: ExperienciaPerfil[];
  formacao: FormacaoPerfil[];
  certificacoes: CertificacaoPerfil[];
  idiomas: string[];
  skills: string[];
}

type PerfilComJson = {
  nome?: unknown;
  contato?: unknown;
  emails?: unknown;
  telefones?: unknown;
  links?: unknown;
  endereco?: unknown;
  outrosContatos?: unknown;
  resumo?: unknown;
  experiencias?: unknown;
  formacao?: unknown;
  certificacoes?: unknown;
  idiomas?: unknown;
  skills?: unknown;
};

const CHAVES_CONTATO = ['emails', 'telefones', 'links', 'endereco', 'outrosContatos'] as const;

function registro(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function textoOuNumero(valor: unknown): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : texto(valor);
}

function semAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inteiro(valor: unknown, minimo: number, maximo: number): number | null {
  const bruto = textoOuNumero(valor);
  if (!/^\d+$/.test(bruto)) return null;
  const numero = Number(bruto);
  return numero >= minimo && numero <= maximo ? numero : null;
}

const mes = (valor: unknown) => inteiro(valor, 1, 12);
const ano = (valor: unknown) => inteiro(valor, 1900, 2100);

function linhas(valor: string): string[] {
  return valor
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
}

function comoLista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  return typeof valor === 'string' ? linhas(valor) : [];
}

export function listaTexto(valor: unknown): string[] {
  return comoLista(valor).map(texto).filter(Boolean);
}

function textoDosEscalares(dado: Record<string, unknown>, ignoradas: readonly string[]): string {
  return Object.entries(dado)
    .filter(([chave]) => !ignoradas.includes(chave))
    .map(([, valor]) => textoOuNumero(valor))
    .filter(Boolean)
    .join(', ');
}

function motivos(valor: unknown, ...extras: MotivoRevisao[]): MotivoRevisao[] {
  const lidos = Array.isArray(valor)
    ? valor.filter((item): item is MotivoRevisao => MOTIVOS_REVISAO.includes(item as MotivoRevisao))
    : [];
  return [...new Set([...lidos, ...extras])];
}

function comRevisao<T extends object>(item: T, revisao: MotivoRevisao[]): T & Revisavel {
  return revisao.length ? { ...item, revisao } : item;
}

function idsUnicos<T extends { id: string }>(itens: T[], prefixo: string): T[] {
  const usados = new Set<string>();
  return itens.map((item, indice) => {
    const base = item.id || `${prefixo}-${indice + 1}`;
    const id = usados.has(base) ? `${base}-${indice + 1}` : base;
    usados.add(id);
    return { ...item, id };
  });
}

function comPrincipalUnico<T extends { principal: boolean }>(itens: T[], elegivel: (item: T) => boolean = () => true): T[] {
  const candidatos = itens.some(elegivel) ? elegivel : () => true;
  const escolhido = itens.findIndex((item) => candidatos(item) && item.principal);
  const indice = escolhido >= 0 ? escolhido : Math.max(0, itens.findIndex(candidatos));
  return itens.map((item, posicao) => ({ ...item, principal: posicao === indice }));
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const SEPARADOR_EMAIL = /[\s,;]+/;

const emailValido = (email: EmailPerfil) => !email.revisao?.includes('email_invalido');

function separarEmails(item: EmailPerfil): EmailPerfil[] {
  const partes = item.valor.split(SEPARADOR_EMAIL).filter(Boolean);
  const valores = partes.length > 1 && partes.every((parte) => EMAIL_RE.test(parte)) ? partes : [item.valor];
  return valores.map((valor, posicao) => {
    const revisao: MotivoRevisao[] = motivos(item.revisao).filter((motivo) => motivo !== 'email_invalido');
    if (!EMAIL_RE.test(valor)) revisao.push('email_invalido');
    const id = posicao === 0 || !item.id ? item.id : `${item.id}-${posicao + 1}`;
    return comRevisao({ id, valor, principal: posicao === 0 && item.principal }, revisao);
  });
}

const ROTULO_STATUS_FORMACAO: Record<string, string> = {
  concluido: 'concluído',
  em_andamento: 'em andamento',
  trancado: 'trancado',
};

function mesAno(mesValor: unknown, anoValor: unknown): string {
  const anoTexto = textoOuNumero(anoValor);
  if (!anoTexto) return '';
  const mesTexto = textoOuNumero(mesValor);
  return mesTexto ? `${mesTexto.padStart(2, '0')}/${anoTexto}` : anoTexto;
}

export function textoFormacao(item: unknown): string {
  if (typeof item === 'string') return texto(item);
  const dado = registro(item);
  if (!dado) return '';
  const grau = texto(dado.grau);
  const curso = texto(dado.curso);
  const titulo = grau && curso ? `${grau} em ${curso}` : grau || curso;
  const status = ROTULO_STATUS_FORMACAO[texto(dado.status)] ?? texto(dado.status);
  const inicio = mesAno(dado.inicioMes, dado.inicioAno);
  const fim = mesAno(dado.fimMes, dado.fimAno);
  const periodo = inicio && fim ? `${inicio} - ${fim}` : inicio ? `${inicio} - atual` : fim;
  return [texto(dado.instituicao), titulo, periodo, status].filter(Boolean).join(' | ');
}

export function textoCertificacao(item: unknown): string {
  if (typeof item === 'string') return texto(item);
  const dado = registro(item);
  if (!dado) return '';
  return [texto(dado.titulo), texto(dado.descricao)].filter(Boolean).join(', ');
}

export function listaFormacao(valor: unknown): string[] {
  return normalizarFormacao(valor).map(textoFormacao).filter(Boolean);
}

export function listaCertificacoes(valor: unknown): string[] {
  return normalizarCertificacoes(valor).map(textoCertificacao).filter(Boolean);
}

function tipoLegado(chave: string): TipoContatoLegado {
  const tipos: Record<string, TipoContatoLegado> = {
    email: 'email',
    telefone: 'telefone',
    linkedin: 'linkedin',
    github: 'github',
    portfolio: 'site',
    site: 'site',
    website: 'site',
    localizacao: 'localizacao',
    cidade: 'localizacao',
  };
  return tipos[semAcentos(chave)] ?? 'outro';
}

function lerContatosLegados(valor: unknown): ContatoLegado[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((item) => {
      const dado = registro(item);
      if (!dado || !texto(dado.valor)) return [];
      const tipo = TIPOS_CONTATO_LEGADO.includes(dado.tipo as TipoContatoLegado)
        ? (dado.tipo as TipoContatoLegado)
        : 'outro';
      const rotulo = tipo === 'outro' ? texto(dado.rotulo) || texto(dado.tipo) : '';
      return [{ tipo, valor: texto(dado.valor), ...(rotulo ? { rotulo } : {}) }];
    });
  }
  const legado = registro(valor);
  if (!legado) return [];
  return Object.entries(legado).flatMap(([chave, bruto]) => {
    const valorTexto = texto(bruto);
    if (!valorTexto) return [];
    const tipo = tipoLegado(chave);
    return [{ tipo, valor: valorTexto, ...(tipo === 'outro' ? { rotulo: chave } : {}) }];
  });
}

const DDI_RE = /^\+\s*(\d{1,3})(?=[\s\-.(])/;

export function lerTelefoneTexto(valor: string): { ddi: string; numero: string; revisao: MotivoRevisao[] } {
  const achado = DDI_RE.exec(valor);
  const numero = achado ? valor.slice(achado[0].length).replace(/^[\s\-.]+/, '').trim() : '';
  if (achado && numero) return { ddi: `+${achado[1]}`, numero, revisao: [] };
  return { ddi: '', numero: valor, revisao: ['ddi_ausente'] };
}

const SEPARADOR_LOCAL = /\s*[,/|]\s*|\s+[-\u2013\u2014]\s+/;
const PAISES_BRASIL = ['brasil', 'brazil', 'br'];

export function lerLocalTexto(valor: string): LocalPerfil | null {
  const partes = valor.split(SEPARADOR_LOCAL).map((parte) => parte.trim()).filter(Boolean);
  if (partes.length < 2 || partes.length > 3) return null;
  const [cidade, estadoBruto, pais] = partes;
  const estado = estadoBruto.toUpperCase();
  if (!UFS_BRASIL.includes(estado as (typeof UFS_BRASIL)[number])) return null;
  if (pais && !PAISES_BRASIL.includes(semAcentos(pais))) return null;
  if (!/\p{L}/u.test(cidade)) return null;
  return { pais: PAIS_BRASIL, estado, cidade };
}

function enderecoDeTexto(valor: string): EnderecoPerfil {
  const local = lerLocalTexto(valor);
  return local ?? { pais: '', estado: '', cidade: '', legado: valor, revisao: ['localizacao_texto'] };
}

function converterContatoLegado(valor: unknown): ContatoPerfil {
  const contato: ContatoPerfil = { emails: [], telefones: [], links: [], endereco: null, outrosContatos: [] };
  lerContatosLegados(valor).forEach((item, indice) => {
    const id = `contato-legado-${indice + 1}`;
    if (item.tipo === 'email') {
      contato.emails.push({ id, valor: item.valor, principal: contato.emails.length === 0 });
    } else if (item.tipo === 'telefone') {
      const { ddi, numero, revisao } = lerTelefoneTexto(item.valor);
      contato.telefones.push(comRevisao({ id, ddi, numero, principal: contato.telefones.length === 0 }, revisao));
    } else if (item.tipo === 'linkedin' || item.tipo === 'github' || item.tipo === 'site') {
      contato.links.push({ id, tipo: item.tipo, url: item.valor });
    } else if (item.tipo === 'localizacao' && !contato.endereco) {
      contato.endereco = enderecoDeTexto(item.valor);
    } else {
      const rotulo = item.tipo === 'localizacao' ? 'Localização' : item.rotulo || 'Outro';
      contato.outrosContatos.push({
        id,
        rotulo,
        valor: item.valor,
        revisao: [item.tipo === 'localizacao' ? 'localizacao_texto' : 'contato_sem_tipo'],
      });
    }
  });
  return contato;
}

function normalizarLocal(valor: unknown): LocalPerfil | null {
  const dado = registro(valor);
  if (!dado) return null;
  const local = { pais: texto(dado.pais), estado: texto(dado.estado), cidade: texto(dado.cidade) };
  if (semAcentos(local.pais) === 'brasil') {
    local.pais = PAIS_BRASIL;
    local.estado = local.estado.toUpperCase();
  }
  return local.pais || local.estado || local.cidade ? local : null;
}

function normalizarEndereco(valor: unknown): EnderecoPerfil | null {
  if (typeof valor === 'string') return texto(valor) ? enderecoDeTexto(texto(valor)) : null;
  const dado = registro(valor);
  if (!dado) return null;
  const local = normalizarLocal(dado) ?? { pais: '', estado: '', cidade: '' };
  const opcionais = {
    ...(texto(dado.bairro) ? { bairro: texto(dado.bairro) } : {}),
    ...(texto(dado.logradouro) ? { logradouro: texto(dado.logradouro) } : {}),
    ...(texto(dado.complemento) ? { complemento: texto(dado.complemento) } : {}),
    ...(texto(dado.legado) ? { legado: texto(dado.legado) } : {}),
  };
  const endereco = comRevisao({ ...local, ...opcionais }, motivos(dado.revisao));
  return local.pais || local.estado || local.cidade || Object.keys(opcionais).length ? endereco : null;
}

function normalizarDdi(valor: unknown): string {
  const digitos = textoOuNumero(valor).replace(/[^\d]/g, '');
  return digitos ? `+${digitos}` : '';
}

function normalizarContatoNovo(dado: Record<string, unknown>): ContatoPerfil {
  const lista = (valor: unknown) => (Array.isArray(valor) ? valor.map(registro).filter((item) => item !== null) : []);
  const emails = lista(dado.emails)
    .map((item) => ({ id: texto(item.id), valor: texto(item.valor), principal: item.principal === true, revisao: motivos(item.revisao) }))
    .filter((item) => item.valor)
    .flatMap(separarEmails);
  const telefones = lista(dado.telefones)
    .map((item) =>
      comRevisao(
        { id: texto(item.id), ddi: normalizarDdi(item.ddi), numero: textoOuNumero(item.numero), principal: item.principal === true },
        motivos(item.revisao),
      ),
    )
    .filter((item) => item.numero);
  const links: LinkPerfil[] = [];
  const outrosContatos: OutroContatoPerfil[] = lista(dado.outrosContatos)
    .map((item) => comRevisao({ id: texto(item.id), rotulo: texto(item.rotulo), valor: texto(item.valor) }, motivos(item.revisao)))
    .filter((item) => item.valor);
  for (const item of lista(dado.links)) {
    const url = texto(item.url);
    if (!url) continue;
    const tipo = texto(item.tipo);
    if (TIPOS_LINK.includes(tipo as TipoLink)) {
      links.push({ id: texto(item.id), tipo: tipo as TipoLink, url });
    } else {
      outrosContatos.push({ id: texto(item.id), rotulo: tipo || 'Link', valor: url, revisao: ['contato_sem_tipo'] });
    }
  }
  return {
    emails: comPrincipalUnico(idsUnicos(emails, 'email'), emailValido),
    telefones: comPrincipalUnico(idsUnicos(telefones, 'telefone')),
    links: idsUnicos(links, 'link'),
    endereco: normalizarEndereco(dado.endereco),
    outrosContatos: idsUnicos(outrosContatos, 'contato'),
  };
}

function temChaveDeContato(dado: Record<string, unknown> | null): dado is Record<string, unknown> {
  return Boolean(dado && CHAVES_CONTATO.some((chave) => chave in dado));
}

export function normalizarContato(perfil: PerfilComJson): ContatoPerfil {
  const doTopo = registro(perfil);
  if (temChaveDeContato(doTopo)) return normalizarContatoNovo(doTopo);
  const coluna = registro(perfil.contato);
  if (temChaveDeContato(coluna)) return normalizarContatoNovo(coluna);
  return normalizarContatoNovo({ ...converterContatoLegado(perfil.contato) });
}

const MESES: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1, enero: 1,
  fev: 2, fevereiro: 2, feb: 2, february: 2, febrero: 2,
  mar: 3, marco: 3, march: 3, marzo: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, maio: 5, may: 5, mayo: 5,
  jun: 6, junho: 6, june: 6, junio: 6,
  jul: 7, julho: 7, july: 7, julio: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, sept: 9, september: 9, septiembre: 9,
  out: 10, outubro: 10, oct: 10, october: 10, octubre: 10,
  nov: 11, novembro: 11, november: 11, noviembre: 11,
  dez: 12, dezembro: 12, dec: 12, december: 12, diciembre: 12,
};

const TERMO_ATUAL = /\b(?:atualmente|atual|presente|present|actual|hoje|o momento|current|now)\b/;
const TERMO_ATUAL_RE = new RegExp(TERMO_ATUAL.source, 'g');
const DATA_RE = /(\d{1,2})\s*\/\s*(\d{4})|\b([a-z]{3,})\.?\s+(?:de\s+)?(\d{4})\b|\b((?:19|20)\d{2})\b/g;
const SOBRA_PERIODO_RE = /\b(?:a|ate|to|hasta|de|desde|from|until|e)\b|[-\u2013\u2014.,/()]/g;

interface DataLida {
  mes: number | null;
  ano: number;
}

interface PeriodoLido {
  inicio: DataLida | null;
  fim: DataLida | null;
  atual: boolean;
  completo: boolean;
}

export function lerPeriodoTexto(valor: string): PeriodoLido {
  const base = semAcentos(valor);
  const datas: DataLida[] = [];
  let sobra = base.replace(DATA_RE, (_todo, mesNum, anoNum, mesNome, anoNome, anoSo) => {
    if (mesNum) {
      const lido = mes(mesNum);
      if (lido === null) return _todo;
      datas.push({ mes: lido, ano: Number(anoNum) });
      return ' ';
    }
    if (mesNome) {
      const lido = MESES[mesNome];
      if (!lido) return _todo;
      datas.push({ mes: lido, ano: Number(anoNome) });
      return ' ';
    }
    datas.push({ mes: null, ano: Number(anoSo) });
    return ' ';
  });
  const atual = TERMO_ATUAL.test(sobra);
  sobra = sobra.replace(TERMO_ATUAL_RE, ' ').replace(SOBRA_PERIODO_RE, ' ').trim();
  const inicio = datas[0] ?? null;
  const fim = atual ? null : datas[1] ?? null;
  const esperadas = atual ? 1 : 2;
  const completo =
    !sobra &&
    datas.length === esperadas &&
    Boolean(inicio?.mes) &&
    (atual || Boolean(fim?.mes)) &&
    (!fim || fim.ano * 12 + (fim.mes ?? 0) >= (inicio?.ano ?? 0) * 12 + (inicio?.mes ?? 0));
  return { inicio, fim, atual, completo };
}

function normalizarExperienciaObjeto(dado: Record<string, unknown>, indice: number): ExperienciaPerfil | null {
  const revisao = motivos(dado.revisao);
  let descricao = texto(dado.descricao);
  let dataInicioMes = mes(dado.dataInicioMes);
  let dataInicioAno = ano(dado.dataInicioAno);
  let dataFimMes = mes(dado.dataFimMes);
  let dataFimAno = ano(dado.dataFimAno);
  let atual = dado.atual === true;
  let periodoLegado = texto(dado.periodoLegado);
  const periodoAntigo = texto(dado.periodo);
  const temDatas = dataInicioAno !== null || dataFimAno !== null || atual;
  if (periodoAntigo && !temDatas) {
    const lido = lerPeriodoTexto(periodoAntigo);
    dataInicioMes = lido.inicio?.mes ?? null;
    dataInicioAno = lido.inicio?.ano ?? null;
    dataFimMes = lido.fim?.mes ?? null;
    dataFimAno = lido.fim?.ano ?? null;
    atual = lido.atual;
    if (!lido.completo) {
      periodoLegado = periodoLegado || periodoAntigo;
      revisao.push('periodo_texto');
    }
  } else if (periodoAntigo && !periodoLegado) {
    const lido = lerPeriodoTexto(periodoAntigo);
    const equivalente =
      lido.completo &&
      lido.atual === atual &&
      lido.inicio?.mes === dataInicioMes &&
      lido.inicio?.ano === dataInicioAno &&
      (atual || (lido.fim?.mes === dataFimMes && lido.fim?.ano === dataFimAno));
    if (!equivalente) {
      periodoLegado = periodoAntigo;
      revisao.push('periodo_texto');
    }
  }
  if (atual) {
    dataFimMes = null;
    dataFimAno = null;
  }

  let local = normalizarLocal(dado.local);
  let localLegado = texto(dado.localLegado);
  if (typeof dado.local === 'string' && texto(dado.local)) {
    local = lerLocalTexto(texto(dado.local));
    if (!local) {
      localLegado = localLegado || texto(dado.local);
      revisao.push('local_texto');
    }
  }

  const tecnologias = listaTexto(dado.tecnologias);
  if (tecnologias.length) {
    const linha = `${PREFIXO_TECNOLOGIAS}${tecnologias.join(', ')}`;
    if (!descricao.split(/\r?\n/).some((existente) => existente.trim() === linha)) {
      descricao = descricao ? `${descricao}\n${linha}` : linha;
    }
    revisao.push('tecnologias_na_descricao');
  }

  const experiencia: ExperienciaPerfil = comRevisao(
    {
      id: texto(dado.id) || `experiencia-${indice + 1}`,
      cargo: texto(dado.cargo),
      empresa: texto(dado.empresa),
      dataInicioMes,
      dataInicioAno,
      dataFimMes,
      dataFimAno,
      atual,
      local,
      descricao,
      ...(periodoLegado ? { periodoLegado } : {}),
      ...(localLegado ? { localLegado } : {}),
    },
    [...new Set(revisao)],
  );
  const temConteudo =
    experiencia.cargo || experiencia.empresa || experiencia.descricao || periodoLegado || localLegado ||
    dataInicioAno !== null || local;
  return temConteudo ? experiencia : null;
}

export function normalizarExperiencias(valor: unknown): ExperienciaPerfil[] {
  if (!Array.isArray(valor)) return [];
  const experiencias = valor.flatMap((item, indice) => {
    if (typeof item === 'string') {
      const descricao = texto(item);
      if (!descricao) return [];
      const partes = descricao.split('|').map((parte) => parte.trim());
      const objeto =
        partes.length >= 4
          ? { empresa: partes[0], cargo: partes[1], periodo: partes[2], descricao: partes.slice(3).join(' | ') }
          : { descricao };
      const experiencia = normalizarExperienciaObjeto({ id: `experiencia-legado-${indice + 1}`, ...objeto }, indice);
      return experiencia ? [experiencia] : [];
    }
    const dado = registro(item);
    if (!dado) return [];
    const experiencia = normalizarExperienciaObjeto(dado, indice);
    return experiencia ? [experiencia] : [];
  });
  return idsUnicos(experiencias, 'experiencia');
}

const CHAVES_FORMACAO = [
  'id', 'grau', 'status', 'instituicao', 'curso', 'inicioMes', 'inicioAno', 'fimMes', 'fimAno', 'revisao',
] as const;

function formacaoAntiga(curso: string, id: string): FormacaoPerfil[] {
  return curso
    ? [{
        id,
        grau: '',
        status: '',
        instituicao: '',
        curso,
        inicioMes: null,
        inicioAno: null,
        fimMes: null,
        fimAno: null,
        revisao: ['formato_antigo'],
      }]
    : [];
}

export function normalizarFormacao(valor: unknown): FormacaoPerfil[] {
  const itens = comoLista(valor).flatMap((item, indice): FormacaoPerfil[] => {
    const idAntigo = `formacao-legado-${indice + 1}`;
    if (typeof item === 'string') return formacaoAntiga(texto(item), idAntigo);
    const dado = registro(item);
    if (!dado) return [];
    const status = texto(dado.status);
    const formacao = comRevisao(
      {
        id: texto(dado.id),
        grau: texto(dado.grau),
        status: STATUS_FORMACAO.includes(status as StatusFormacao) ? (status as StatusFormacao) : ('' as const),
        instituicao: texto(dado.instituicao),
        curso: texto(dado.curso),
        inicioMes: mes(dado.inicioMes),
        inicioAno: ano(dado.inicioAno),
        fimMes: mes(dado.fimMes),
        fimAno: ano(dado.fimAno),
      },
      motivos(dado.revisao),
    );
    if (formacao.grau || formacao.instituicao || formacao.curso) return [formacao];
    return formacaoAntiga(textoDosEscalares(dado, CHAVES_FORMACAO), formacao.id || idAntigo);
  });
  return idsUnicos(itens, 'formacao');
}

const CHAVES_CERTIFICACAO = ['id', 'titulo', 'descricao', 'revisao'] as const;

function certificacaoAntiga(titulo: string, id: string): CertificacaoPerfil[] {
  return titulo ? [{ id, titulo, descricao: '', revisao: ['formato_antigo'] }] : [];
}

export function normalizarCertificacoes(valor: unknown): CertificacaoPerfil[] {
  const itens = comoLista(valor).flatMap((item, indice): CertificacaoPerfil[] => {
    const idAntigo = `certificacao-legado-${indice + 1}`;
    if (typeof item === 'string') return certificacaoAntiga(texto(item), idAntigo);
    const dado = registro(item);
    if (!dado) return [];
    const certificacao = comRevisao(
      { id: texto(dado.id), titulo: texto(dado.titulo), descricao: texto(dado.descricao) },
      motivos(dado.revisao),
    );
    if (certificacao.titulo || certificacao.descricao) return [certificacao];
    return certificacaoAntiga(textoDosEscalares(dado, CHAVES_CERTIFICACAO), certificacao.id || idAntigo);
  });
  return idsUnicos(itens, 'certificacao');
}

export function formatarMesAno(mesValor: number | null, anoValor: number | null): string {
  if (anoValor === null) return '';
  return mesValor === null ? String(anoValor) : `${String(mesValor).padStart(2, '0')}/${anoValor}`;
}

export function periodoExperiencia(experiencia: ExperienciaPerfil, termoAtual = 'atual'): string {
  const inicio = formatarMesAno(experiencia.dataInicioMes, experiencia.dataInicioAno);
  const fim = experiencia.atual ? termoAtual : formatarMesAno(experiencia.dataFimMes, experiencia.dataFimAno);
  const estruturado = inicio && fim ? `${inicio} - ${fim}` : inicio || fim;
  return estruturado && !experiencia.periodoLegado ? estruturado : experiencia.periodoLegado || estruturado;
}

export function textoLocal(local: LocalPerfil | null): string {
  if (!local) return '';
  return [local.cidade, local.estado].filter(Boolean).join(' - ') || local.pais;
}

export function localExperiencia(experiencia: ExperienciaPerfil): string {
  return textoLocal(experiencia.local) || experiencia.localLegado || '';
}

const BULLET_RE = /^[-*•]\s+/;

function linhasDescricao(descricao: string): string[] {
  return descricao
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
}

export function extrairRealizacoes(descricao: string): string[] {
  const linhas = linhasDescricao(descricao).filter((linha) => !linha.startsWith(PREFIXO_TECNOLOGIAS));
  const bullets = linhas
    .filter((linha) => BULLET_RE.test(linha))
    .map((linha) => linha.replace(BULLET_RE, '').trim())
    .filter(Boolean);
  return bullets.length ? bullets : linhas.length ? [linhas.join('\n')] : [];
}

export function tituloExperiencia(experiencia: ExperienciaPerfil): string {
  if (experiencia.cargo && experiencia.empresa) {
    return `${experiencia.cargo} na ${experiencia.empresa}`;
  }
  return experiencia.cargo || experiencia.empresa || 'Experiência registrada';
}

export function textoExperiencia(experiencia: ExperienciaPerfil): string {
  const periodo = periodoExperiencia(experiencia);
  const local = localExperiencia(experiencia);
  const cabecalho = [
    experiencia.cargo && `Cargo: ${experiencia.cargo}`,
    experiencia.empresa && `Empresa: ${experiencia.empresa}`,
    periodo && `Período: ${periodo}`,
    local && `Local: ${local}`,
  ]
    .filter(Boolean)
    .join('\n');
  const descricao = linhasDescricao(experiencia.descricao)
    .map((linha) => (BULLET_RE.test(linha) ? `- ${linha.replace(BULLET_RE, '').trim()}` : linha))
    .join('\n');
  return [cabecalho, descricao].filter(Boolean).join('\n');
}

export function normalizarPerfil<T extends PerfilComJson>(
  perfil: T,
): Omit<T, keyof PerfilComJson> & PerfilNormalizado {
  return {
    ...(semContato(perfil as Record<string, unknown>) as Omit<T, keyof PerfilComJson>),
    nome: texto(perfil.nome),
    resumo: texto(perfil.resumo),
    ...normalizarContato(perfil),
    experiencias: normalizarExperiencias(perfil.experiencias),
    formacao: normalizarFormacao(perfil.formacao),
    certificacoes: normalizarCertificacoes(perfil.certificacoes),
    idiomas: listaTexto(perfil.idiomas),
    skills: listaTexto(perfil.skills),
  };
}

export function semContato<T extends Record<string, unknown>>(perfil: T): Omit<T, 'contato' | (typeof CHAVES_CONTATO)[number]> {
  const resto: Record<string, unknown> = { ...perfil };
  for (const chave of ['contato', ...CHAVES_CONTATO]) delete resto[chave];
  return resto as Omit<T, 'contato' | (typeof CHAVES_CONTATO)[number]>;
}

export function perfilParaPersistencia(perfil: PerfilNormalizado) {
  return {
    nome: perfil.nome,
    contato: {
      emails: perfil.emails,
      telefones: perfil.telefones,
      links: perfil.links,
      endereco: perfil.endereco,
      outrosContatos: perfil.outrosContatos,
    },
    resumo: perfil.resumo,
    experiencias: perfil.experiencias,
    formacao: perfil.formacao,
    certificacoes: perfil.certificacoes,
    idiomas: perfil.idiomas,
    skills: perfil.skills,
  };
}

function localParaIa(local: LocalPerfil | null) {
  return local ? { pais: local.pais, estado: local.estado, cidade: local.cidade } : null;
}

export function perfilParaIa(perfil: PerfilComJson) {
  const normalizado = normalizarPerfil(perfil);
  return {
    nome: normalizado.nome,
    emails: normalizado.emails.map(({ valor, principal }) => ({ valor, principal })),
    telefones: normalizado.telefones.map(({ ddi, numero, principal }) => ({ ddi, numero, principal })),
    links: normalizado.links.map(({ tipo, url }) => ({ tipo, url })),
    endereco: localParaIa(normalizado.endereco),
    resumo: normalizado.resumo,
    experiencias: normalizado.experiencias.map((experiencia) => ({
      id: experiencia.id,
      cargo: experiencia.cargo,
      empresa: experiencia.empresa,
      dataInicioMes: experiencia.dataInicioMes,
      dataInicioAno: experiencia.dataInicioAno,
      dataFimMes: experiencia.dataFimMes,
      dataFimAno: experiencia.dataFimAno,
      atual: experiencia.atual,
      local: localParaIa(experiencia.local),
      localLegado: experiencia.localLegado ?? '',
      periodoLegado: experiencia.periodoLegado ?? '',
      descricao: experiencia.descricao,
      realizacoes: extrairRealizacoes(experiencia.descricao),
      texto: textoExperiencia(experiencia),
    })),
    formacao: normalizado.formacao.map(({ revisao: _revisao, id: _id, ...formacao }) => formacao),
    certificacoes: normalizado.certificacoes.map(({ titulo, descricao }) => ({ titulo, descricao })),
    idiomas: normalizado.idiomas,
    skills: normalizado.skills,
  };
}
