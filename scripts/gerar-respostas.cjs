const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const raiz = path.resolve(__dirname, '..');
const config = ts.readConfigFile(path.join(raiz, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, raiz);
const programa = ts.createProgram(parsed.fileNames, parsed.options);
const checker = programa.getTypeChecker();
const objetos = new Map();
const classes = [];
const respostas = [];

function esquema(tipo) {
  if (tipo.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { oneOf: [{}] };
  if (tipo.flags & ts.TypeFlags.Never) return {};
  if (tipo.flags & ts.TypeFlags.Null) return { type: 'string', enum: [null], nullable: true };
  if (tipo.isUnion()) {
    const partes = tipo.types.filter((parte) => !(parte.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
    const nullable = tipo.types.some((parte) => parte.flags & ts.TypeFlags.Null);
    if (partes.length === 1) return { ...esquema(partes[0]), ...(nullable ? { nullable } : {}) };
    const valores = partes.map((parte) => parte.isLiteral() ? parte.value : parte.flags & ts.TypeFlags.BooleanLiteral ? parte.intrinsicName === 'true' : undefined);
    if (valores.every((valor) => valor !== undefined) && new Set(valores.map((valor) => typeof valor)).size === 1) {
      return { type: typeof valores[0], enum: valores, ...(nullable ? { nullable } : {}) };
    }
    if (tipo.aliasSymbol?.name === 'JsonValue') return { oneOf: [{}], nullable: true };
    return { oneOf: partes.map(esquema), ...(nullable ? { nullable } : {}) };
  }
  if (tipo.flags & ts.TypeFlags.StringLike) return { type: 'string', ...(tipo.isLiteral() ? { enum: [tipo.value] } : {}) };
  if (tipo.flags & ts.TypeFlags.NumberLike) return { type: 'number', ...(tipo.isLiteral() ? { enum: [tipo.value] } : {}) };
  if (tipo.flags & ts.TypeFlags.BooleanLike) return { type: 'boolean' };
  if (tipo.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)) return null;
  if (tipo.symbol?.name === 'Date') return { type: 'string', format: 'date-time' };
  if (checker.isArrayType(tipo) || checker.isTupleType(tipo)) return { type: 'array', items: esquema(checker.getTypeArguments(tipo)[0]) ?? {} };
  if (tipo.aliasSymbol?.name === 'JsonObject' || tipo.symbol?.name === 'JsonObject') return { type: 'object', additionalProperties: {} };
  const propriedades = checker.getPropertiesOfType(tipo);
  if (!propriedades.length) {
    const indice = checker.getIndexTypeOfType(tipo, ts.IndexKind.String);
    return { type: 'object', additionalProperties: indice ? esquema(indice) ?? {} : true };
  }
  if (objetos.has(tipo.id)) return { $ref: `#/components/schemas/${objetos.get(tipo.id)}` };
  const nome = tiposNomeados.get(tipo.id) ?? (tipo.symbol?.name === 'HealthResponseDto' ? 'HealthResponseDto' : `RespostaObjeto${objetos.size + 1}Dto`);
  objetos.set(tipo.id, nome);
  const campos = [];
  classes.push({ nome, campos });
  for (const prop of propriedades) {
    const local = prop.valueDeclaration ?? prop.declarations?.[0];
    if (!local) continue;
    const tipoCampo = checker.getTypeOfSymbolAtLocation(prop, local);
    if (tipoCampo.flags & ts.TypeFlags.Undefined) continue;
    const tipoJson = tiposJson.get(prop.name);
    const json = tipoCampo.aliasSymbol?.name === 'JsonValue' || (tipoCampo.isUnion() && tipoCampo.types.some((parte) => parte.aliasSymbol?.name === 'JsonValue'));
    const schema = json && prop.name === 'keywords'
      ? { type: 'array', items: esquema(tiposContrato.get('Keyword')), nullable: true }
      : json && tipoJson ? { ...esquema(tipoJson), nullable: true } : esquema(tipoCampo) ?? {};
    campos.push({ nome: prop.name, schema, obrigatorio: !(prop.flags & ts.SymbolFlags.Optional) });
  }
  return { $ref: `#/components/schemas/${nome}` };
}

const tiposNomeados = new Map();
const tiposJson = new Map();
const tiposContrato = new Map();
for (const arquivo of programa.getSourceFiles()) {
  if (!/[/\\]src[/\\](clients[/\\]ai.client|copiloto[/\\]eventos|observabilidade[/\\]erros)\.ts$/.test(arquivo.fileName)) continue;
  for (const declaracao of arquivo.statements) {
    if (!ts.isInterfaceDeclaration(declaracao) && !ts.isTypeAliasDeclaration(declaracao)) continue;
    const nome = declaracao.name.text;
    if (!['Keyword', 'ScoreBreakdown', 'AtsAnalysis', 'CopilotoEvento', 'AvisoAcao', 'CorpoErro', 'RespostaExcecao'].includes(nome)) continue;
    const tipo = checker.getTypeAtLocation(declaracao);
    tiposNomeados.set(tipo.id, nome);
    tiposContrato.set(nome, tipo);
  }
}
for (const [campo, nome] of [['breakdown', 'ScoreBreakdown'], ['analiseInicial', 'AtsAnalysis'], ['analiseFinal', 'AtsAnalysis']]) {
  tiposJson.set(campo, tiposContrato.get(nome));
}
for (const arquivo of programa.getSourceFiles().filter((arquivo) => arquivo.fileName.endsWith('.controller.ts')).sort((a, b) => a.fileName.localeCompare(b.fileName))) {
  for (const classe of arquivo.statements.filter(ts.isClassDeclaration)) {
    for (const metodo of classe.members.filter(ts.isMethodDeclaration)) {
      const decorators = ts.getDecorators(metodo) ?? [];
      if (!decorators.some((decorator) => /^(Get|Post|Put|Patch|Delete|Head|Options)\(/.test(decorator.expression.getText(arquivo)))) continue;
      const assinatura = checker.getSignatureFromDeclaration(metodo);
      const tipo = checker.getAwaitedType(checker.getReturnTypeOfSignature(assinatura));
      respostas.push({ controller: classe.name.text, metodo: metodo.name.getText(arquivo), schema: esquema(tipo) });
    }
  }
}

const eventosCopiloto = esquema(tiposContrato.get('CopilotoEvento'));
for (const tipo of tiposContrato.values()) esquema(tipo);

const linhas = ["import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';", ''];
for (const { nome, campos } of classes) {
  linhas.push(`export class ${nome} {`);
  for (const campo of campos) {
    const { $ref, ...schema } = campo.schema;
    const propriedade = $ref ? `{ ...${JSON.stringify(schema)}, type: () => ${$ref.split('/').at(-1)} }` : JSON.stringify(schema);
    linhas.push(`  @${campo.obrigatorio ? 'ApiProperty' : 'ApiPropertyOptional'}(${propriedade})`, `  ${JSON.stringify(campo.nome)}!: unknown;`, '');
  }
  linhas.push('}', '');
}
linhas.push(`export const modelosResposta = [${classes.map((classe) => classe.nome).join(', ')}];`, `export const respostasContrato = ${JSON.stringify(respostas, null, 2)};`, `export const eventosCopiloto = ${JSON.stringify(eventosCopiloto)};`, '');
fs.mkdirSync(path.join(raiz, 'src/contrato'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'src/contrato/respostas.dto.ts'), linhas.join('\n'));
