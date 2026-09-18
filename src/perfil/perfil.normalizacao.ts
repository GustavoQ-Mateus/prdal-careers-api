export const TIPOS_CONTATO = [
  'email',
  'telefone',
  'linkedin',
  'github',
  'site',
  'localizacao',
  'outro',
] as const;

export type TipoContato = (typeof TIPOS_CONTATO)[number];

export interface ContatoPerfil {
  id: string;
  tipo: TipoContato;
  valor: string;
  rotulo?: string;
}

export interface ExperienciaPerfil {
  id: string;
  cargo: string;
  empresa: string;
  periodo: string;
  local?: string;
  descricao: string;
  tecnologias?: string[];
}

type PerfilComJson = {
  nome?: unknown;
  contato?: unknown;
  resumo?: unknown;
  experiencias?: unknown;
  formacao?: unknown;
  certificacoes?: unknown;
  idiomas?: unknown;
  skills?: unknown;
};

function registro(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function listaTexto(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.map(texto).filter(Boolean)
    : [];
}

function tipoContato(valor: unknown): TipoContato {
  return typeof valor === 'string' && TIPOS_CONTATO.includes(valor as TipoContato)
    ? (valor as TipoContato)
    : 'outro';
}

function tipoLegado(chave: string): TipoContato {
  const normalizada = chave
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const tipos: Record<string, TipoContato> = {
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
  return tipos[normalizada] ?? 'outro';
}

function idsUnicos<T extends { id: string }>(itens: T[]): T[] {
  const usados = new Set<string>();
  return itens.map((item, indice) => {
    const base = item.id || `entrada-${indice + 1}`;
    const id = usados.has(base) ? `${base}-${indice + 1}` : base;
    usados.add(id);
    return { ...item, id };
  });
}

export function normalizarContato(valor: unknown): ContatoPerfil[] {
  if (Array.isArray(valor)) {
    const contatos = valor.flatMap((item, indice) => {
      const dado = registro(item);
      if (!dado) return [];
      const tipo = tipoContato(dado.tipo);
      const contato: ContatoPerfil = {
        id: texto(dado.id) || `contato-${indice + 1}`,
        tipo,
        valor: texto(dado.valor),
        ...(tipo === 'outro' && texto(dado.rotulo) ? { rotulo: texto(dado.rotulo) } : {}),
      };
      return contato.valor ? [contato] : [];
    });
    return idsUnicos(contatos);
  }

  const legado = registro(valor);
  if (!legado) return [];
  return idsUnicos(
    Object.entries(legado).flatMap(([chave, bruto], indice) => {
      const valor = texto(bruto);
      if (!valor) return [];
      const tipo = tipoLegado(chave);
      return [{
        id: `contato-legado-${indice + 1}`,
        tipo,
        valor,
        ...(tipo === 'outro' ? { rotulo: chave } : {}),
      }];
    }),
  );
}

export function normalizarExperiencias(valor: unknown): ExperienciaPerfil[] {
  if (!Array.isArray(valor)) return [];
  const experiencias = valor.flatMap((item, indice) => {
    if (typeof item === 'string') {
      const descricao = texto(item);
      const partes = descricao.split('|').map((parte) => parte.trim());
      if (partes.length >= 4) {
        return [{
          id: `experiencia-legado-${indice + 1}`,
          empresa: partes[0],
          cargo: partes[1],
          periodo: partes[2],
          descricao: partes.slice(3).join(' | '),
        }];
      }
      return descricao
        ? [{
            id: `experiencia-legado-${indice + 1}`,
            cargo: '',
            empresa: '',
            periodo: '',
            descricao,
          }]
        : [];
    }
    const dado = registro(item);
    if (!dado) return [];
    const tecnologias = listaTexto(dado.tecnologias);
    const experiencia: ExperienciaPerfil = {
      id: texto(dado.id) || `experiencia-${indice + 1}`,
      cargo: texto(dado.cargo),
      empresa: texto(dado.empresa),
      periodo: texto(dado.periodo),
      descricao: texto(dado.descricao),
      ...(texto(dado.local) ? { local: texto(dado.local) } : {}),
      ...(tecnologias.length ? { tecnologias } : {}),
    };
    return experiencia.descricao || experiencia.cargo || experiencia.empresa || experiencia.periodo
      ? [experiencia]
      : [];
  });
  return idsUnicos(experiencias);
}

export function extrairRealizacoes(descricao: string): string[] {
  const linhas = descricao
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
  const bullets = linhas
    .filter((linha) => /^[-*•]\s+/.test(linha))
    .map((linha) => linha.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);
  return bullets.length ? bullets : descricao.trim() ? [descricao.trim()] : [];
}

export function tituloExperiencia(experiencia: ExperienciaPerfil): string {
  if (experiencia.cargo && experiencia.empresa) {
    return `${experiencia.cargo} na ${experiencia.empresa}`;
  }
  return experiencia.cargo || experiencia.empresa || 'Experiência registrada';
}

export function textoExperiencia(experiencia: ExperienciaPerfil): string {
  const cabecalho = [
    experiencia.cargo && `Cargo: ${experiencia.cargo}`,
    experiencia.empresa && `Empresa: ${experiencia.empresa}`,
    experiencia.periodo && `Período: ${experiencia.periodo}`,
    experiencia.local && `Local: ${experiencia.local}`,
    experiencia.tecnologias?.length && `Tecnologias e competências: ${experiencia.tecnologias.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
  const realizacoes = extrairRealizacoes(experiencia.descricao)
    .map((realizacao) => `- ${realizacao}`)
    .join('\n');
  return [cabecalho, realizacoes].filter(Boolean).join('\n');
}

export function contatosParaObjeto(contatos: ContatoPerfil[]): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const contato of contatos) {
    const base = (contato.tipo === 'outro' ? contato.rotulo || 'outro' : contato.tipo)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'outro';
    const chave = resultado[base] ? `${base}_${Object.keys(resultado).length + 1}` : base;
    resultado[chave] = contato.valor;
  }
  return resultado;
}

export function normalizarPerfil<T extends PerfilComJson>(perfil: T): Omit<T, 'contato' | 'experiencias'> & {
  contato: ContatoPerfil[];
  experiencias: ExperienciaPerfil[];
  certificacoes: string[];
  idiomas: string[];
} {
  return {
    ...perfil,
    contato: normalizarContato(perfil.contato),
    experiencias: normalizarExperiencias(perfil.experiencias),
    certificacoes: listaTexto(perfil.certificacoes),
    idiomas: listaTexto(perfil.idiomas),
  };
}

export function perfilParaIa(perfil: PerfilComJson) {
  const experiencias = normalizarExperiencias(perfil.experiencias);
  return {
    nome: texto(perfil.nome),
    contato: contatosParaObjeto(normalizarContato(perfil.contato)),
    resumo: texto(perfil.resumo),
    experiencias: experiencias.map((experiencia) => ({
      ...experiencia,
      realizacoes: extrairRealizacoes(experiencia.descricao),
      texto: textoExperiencia(experiencia),
    })),
    formacao: listaTexto(perfil.formacao),
    certificacoes: listaTexto(perfil.certificacoes),
    idiomas: listaTexto(perfil.idiomas),
    skills: listaTexto(perfil.skills),
  };
}
