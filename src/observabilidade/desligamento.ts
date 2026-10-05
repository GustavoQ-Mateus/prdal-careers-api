import type { INestApplication, LoggerService } from '@nestjs/common';
import type { Server } from 'node:http';

export const MENSAGEM_DESLIGAMENTO =
  'O servidor está reiniciando e a resposta foi interrompida. Envie a mensagem de novo para continuar.';

const PRAZO_PADRAO_MS = 25_000;
const INTERVALO_VERIFICACAO_MS = 50;

type Encerrador = () => void;

const turnosAbertos = new Set<Encerrador>();
const trabalhos = new Set<Promise<unknown>>();
let requisicoesAtivas = 0;
let desligando = false;

export function prazoDesligamentoMs(env: Record<string, string | undefined> = process.env): number {
  const valor = Number(env.DESLIGAMENTO_PRAZO_MS);
  return Number.isFinite(valor) && valor > 0 ? valor : PRAZO_PADRAO_MS;
}

export function emDesligamento(): boolean {
  return desligando;
}

export function registrarTurnoAberto(encerrar: Encerrador): () => void {
  turnosAbertos.add(encerrar);
  return () => {
    turnosAbertos.delete(encerrar);
  };
}

export function acompanharTrabalho<T>(trabalho: Promise<T>): Promise<T> {
  trabalhos.add(trabalho);
  const remover = () => {
    trabalhos.delete(trabalho);
  };
  trabalho.then(remover, remover);
  return trabalho;
}

export function inicioRequisicao(): () => void {
  requisicoesAtivas++;
  let encerrada = false;
  return () => {
    if (encerrada) return;
    encerrada = true;
    requisicoesAtivas--;
  };
}

export function pendencias(): { requisicoes: number; turnos: number; trabalhos: number } {
  return { requisicoes: requisicoesAtivas, turnos: turnosAbertos.size, trabalhos: trabalhos.size };
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

export async function desligar(
  app: INestApplication,
  logger: LoggerService,
  prazoMs = prazoDesligamentoMs(),
): Promise<{ limpo: boolean }> {
  if (desligando) return { limpo: false };
  desligando = true;
  const servidor = app.getHttpServer() as Server;
  logger.log({ mensagem: 'desligamento iniciado', prazoMs, ...pendencias() }, 'Desligamento');
  servidor.close();
  servidor.closeIdleConnections();
  for (const encerrar of [...turnosAbertos]) {
    try {
      encerrar();
    } catch (err) {
      logger.warn({ mensagem: 'falha ao encerrar turno aberto', erro: (err as Error).message }, 'Desligamento');
    }
  }
  const limite = Date.now() + prazoMs;
  while (Date.now() < limite) {
    const { requisicoes, trabalhos: emCurso } = pendencias();
    if (requisicoes === 0 && emCurso === 0) break;
    servidor.closeIdleConnections();
    await esperar(INTERVALO_VERIFICACAO_MS);
  }
  const restantes = pendencias();
  const limpo = restantes.requisicoes === 0 && restantes.trabalhos === 0;
  if (!limpo) {
    logger.warn(
      {
        mensagem: 'prazo de desligamento esgotado; conexoes encerradas a forca e geracoes em andamento ficam pendentes para o proximo boot',
        ...restantes,
      },
      'Desligamento',
    );
    servidor.closeAllConnections();
  }
  await app.close();
  logger.log({ mensagem: 'desligamento concluido', limpo }, 'Desligamento');
  return { limpo };
}

export function reiniciarEstadoDesligamento(): void {
  desligando = false;
  requisicoesAtivas = 0;
  turnosAbertos.clear();
  trabalhos.clear();
}
