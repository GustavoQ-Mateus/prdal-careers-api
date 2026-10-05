import type { LoggerService } from '@nestjs/common';
import { requestIdAtual } from './contexto';

type Nivel = 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';

const NIVEIS_DETALHADOS = new Set<Nivel>(['debug', 'verbose']);

export type Escritor = (linha: string) => void;

const escritorPadrao: Escritor = (linha) => process.stdout.write(`${linha}\n`);

function pareceStack(valor: unknown): valor is string {
  return typeof valor === 'string' && /\n\s+at /.test(valor);
}

export class LoggerJson implements LoggerService {
  constructor(
    private readonly servico = 'api',
    private readonly escrever: Escritor = escritorPadrao,
    private readonly detalhado = (process.env.LOG_NIVEL ?? '').trim().toLowerCase() === 'debug',
  ) {}

  log(mensagem: unknown, ...extras: unknown[]) {
    this.registrar('log', mensagem, extras);
  }

  error(mensagem: unknown, ...extras: unknown[]) {
    this.registrar('error', mensagem, extras);
  }

  warn(mensagem: unknown, ...extras: unknown[]) {
    this.registrar('warn', mensagem, extras);
  }

  debug(mensagem: unknown, ...extras: unknown[]) {
    this.registrar('debug', mensagem, extras);
  }

  verbose(mensagem: unknown, ...extras: unknown[]) {
    this.registrar('verbose', mensagem, extras);
  }

  fatal(mensagem: unknown, ...extras: unknown[]) {
    this.registrar('fatal', mensagem, extras);
  }

  private registrar(nivel: Nivel, mensagem: unknown, extras: unknown[]) {
    if (NIVEIS_DETALHADOS.has(nivel) && !this.detalhado) return;
    const resto = [...extras];
    const contexto = typeof resto[resto.length - 1] === 'string' && !pareceStack(resto[resto.length - 1]) ? (resto.pop() as string) : undefined;
    const stack = resto.find(pareceStack);
    const campos: Record<string, unknown> =
      mensagem && typeof mensagem === 'object' && !(mensagem instanceof Error) ? { ...(mensagem as Record<string, unknown>) } : {};
    const texto =
      mensagem instanceof Error ? mensagem.message : typeof mensagem === 'string' ? mensagem : (campos.mensagem as string | undefined);
    delete campos.mensagem;
    const requestId = (campos.requestId as string | undefined) ?? requestIdAtual();
    delete campos.requestId;
    const linha = {
      horario: new Date().toISOString(),
      nivel,
      servico: this.servico,
      ...(contexto ? { contexto } : {}),
      ...(requestId ? { requestId } : {}),
      mensagem: texto ?? '',
      ...campos,
      ...(stack ? { stack } : mensagem instanceof Error && mensagem.stack ? { stack: mensagem.stack } : {}),
    };
    this.escrever(JSON.stringify(linha));
  }
}
