import { getMetadataStorage } from 'class-validator';
type ValidationMetadata = ReturnType<ReturnType<typeof getMetadataStorage>['getTargetValidationMetadatas']>[number];

export type ClasseDto = new () => object;

export interface OpcoesEsquema {
  descricoes?: Record<string, string>;
  omitir?: string[];
}

export interface EsquemaDto {
  schema: Record<string, unknown>;
  opcionais: number;
}

const SEM_EQUIVALENTE_ESTRITO = new Set([
  'maxLength',
  'minLength',
  'min',
  'max',
  'arrayMaxSize',
  'arrayMinSize',
  'isNotEmpty',
]);

interface Propriedade {
  tipo?: Record<string, unknown>;
  item?: Record<string, unknown>;
  lista: boolean;
  opcional: boolean;
}

function valoresDeEnum(valores: unknown[]): Record<string, unknown> {
  const unicos = [...new Set(valores)];
  const tipo = unicos.every((valor) => typeof valor === 'string') ? 'string' : undefined;
  return tipo ? { type: tipo, enum: unicos } : { enum: unicos };
}

function tipoDoValidador(meta: ValidationMetadata): Record<string, unknown> {
  const restricao = meta.constraints?.[0];
  switch (meta.name) {
    case 'isString':
      return { type: 'string' };
    case 'isInt':
      return { type: 'integer' };
    case 'isNumber':
      return { type: 'number' };
    case 'isBoolean':
      return { type: 'boolean' };
    case 'isIn':
      return valoresDeEnum(restricao as unknown[]);
    case 'isEnum':
      return valoresDeEnum(Object.values(restricao as Record<string, unknown>));
    case 'isDateString':
    case 'isISO8601':
      return { type: 'string', format: 'date-time' };
    default:
      throw new Error(`validador sem equivalente em JSON Schema: ${meta.name} em ${meta.propertyName}`);
  }
}

export function esquemaDoDto(dto: ClasseDto, opcoes: OpcoesEsquema = {}): EsquemaDto {
  const omitir = new Set(opcoes.omitir ?? []);
  const propriedades = new Map<string, Propriedade>();
  for (const meta of getMetadataStorage().getTargetValidationMetadatas(dto, '', true, false)) {
    if (omitir.has(meta.propertyName)) continue;
    const propriedade = propriedades.get(meta.propertyName) ?? { lista: false, opcional: false };
    propriedades.set(meta.propertyName, propriedade);
    if (meta.name === 'isOptional') {
      propriedade.opcional = true;
      continue;
    }
    if (SEM_EQUIVALENTE_ESTRITO.has(meta.name ?? '')) continue;
    if (meta.name === 'isArray') {
      propriedade.lista = true;
      continue;
    }
    const tipo = tipoDoValidador(meta);
    if (meta.each) propriedade.item = tipo;
    else propriedade.tipo = tipo;
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  let opcionais = 0;
  for (const [nome, propriedade] of propriedades) {
    const base = propriedade.lista
      ? { type: 'array', items: propriedade.item ?? { type: 'string' } }
      : propriedade.tipo;
    if (!base) throw new Error(`propriedade sem tipo no DTO ${dto.name}: ${nome}`);
    const descricao = opcoes.descricoes?.[nome];
    properties[nome] = descricao ? { ...base, description: descricao } : base;
    if (propriedade.opcional) opcionais++;
    else required.push(nome);
  }
  return {
    schema: { type: 'object', properties, required, additionalProperties: false },
    opcionais,
  };
}
