import { Injectable } from '@nestjs/common';
import { CopilotoMensagem, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { DadosNarracao, MensagensNarracao } from '../pipeline-ats/narracao';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmacaoCopiloto,
  ConversaCopiloto,
  MensagemCopiloto,
  ModoCopiloto,
  PendenciaCopiloto,
  ResumoConversa,
} from './tipos';

type Transacao = Prisma.TransactionClient;

export interface ConversaListada {
  id: string;
  modo: ModoCopiloto;
  oportunidadeId: string | null;
  totalMensagens: number;
  primeiraDoCandidato: string | null;
  ultimaComTexto: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const LIMITE_LISTA = 30;

function json(valor: unknown): Prisma.InputJsonValue | undefined {
  return valor === undefined || valor === null ? undefined : (valor as Prisma.InputJsonValue);
}

export function paraMensagem(linha: Pick<CopilotoMensagem, 'papel' | 'conteudo' | 'tool' | 'blocos' | 'dados'>): MensagemCopiloto {
  const mensagem: MensagemCopiloto = { papel: linha.papel, conteudo: linha.conteudo };
  if (linha.tool !== null) mensagem.tool = linha.tool;
  if (linha.blocos !== null) mensagem.blocos = linha.blocos as unknown as MensagemCopiloto['blocos'];
  if (linha.dados !== null) mensagem.dados = linha.dados as unknown as MensagemCopiloto['dados'];
  return mensagem;
}

@Injectable()
export class ConversasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string, oportunidadeId?: string): Promise<ConversaListada[]> {
    const filtroOportunidade = oportunidadeId ? Prisma.sql`AND c.oportunidade_id = ${oportunidadeId}` : Prisma.empty;
    return this.prisma.$queryRaw<ConversaListada[]>`
      SELECT c.id,
             c.modo::text AS "modo",
             c.oportunidade_id AS "oportunidadeId",
             c.total_mensagens AS "totalMensagens",
             (SELECT m.conteudo FROM copiloto_mensagens m
               WHERE m.conversa_id = c.id AND m.papel = 'user'
               ORDER BY m.ordem LIMIT 1) AS "primeiraDoCandidato",
             (SELECT m.conteudo FROM copiloto_mensagens m
               WHERE m.conversa_id = c.id AND m.conteudo ~ '\\S'
               ORDER BY m.ordem DESC LIMIT 1) AS "ultimaComTexto",
             c.criado_em AS "criadoEm",
             c.atualizado_em AS "atualizadoEm"
        FROM copiloto_conversas c
       WHERE c.usuario_id = ${usuarioId} ${filtroOportunidade}
       ORDER BY c.atualizado_em DESC
       LIMIT ${LIMITE_LISTA}`;
  }

  async buscarCompleta(usuarioId: string, id: string): Promise<ConversaCopiloto | null> {
    const conversa = await this.prisma.copilotoConversa.findFirst({ where: { id, usuarioId } });
    if (!conversa) return null;
    const mensagens = await this.prisma.copilotoMensagem.findMany({ where: { conversaId: id }, orderBy: { ordem: 'asc' } });
    return this.montar(conversa, mensagens.map(paraMensagem), 0);
  }

  async abrirJanela(usuarioId: string, id: string): Promise<ConversaCopiloto | null> {
    const conversa = await this.prisma.copilotoConversa.findFirst({ where: { id, usuarioId } });
    if (!conversa) return null;
    const resumo = conversa.resumo as unknown as ResumoConversa | null;
    const inicio = Math.max(0, Math.min(resumo?.ate ?? 0, conversa.totalMensagens));
    const mensagens = await this.prisma.copilotoMensagem.findMany({
      where: { conversaId: id, ordem: { gte: inicio } },
      orderBy: { ordem: 'asc' },
    });
    return this.montar(conversa, mensagens.map(paraMensagem), inicio);
  }

  async criar(usuarioId: string, modo: ModoCopiloto, oportunidadeId: string | null): Promise<ConversaCopiloto> {
    const agora = new Date();
    const conversa = await this.prisma.copilotoConversa.create({
      data: { id: randomUUID(), usuarioId, modo, oportunidadeId, criadoEm: agora, atualizadoEm: agora },
    });
    return this.montar(conversa, [], 0);
  }

  async atualizarModo(id: string, modo: ModoCopiloto, oportunidadeId: string | null): Promise<void> {
    await this.prisma.copilotoConversa.update({
      where: { id },
      data: { modo, ...(oportunidadeId ? { oportunidadeId } : {}) },
    });
  }

  async anexar(conversaId: string, mensagem: MensagemCopiloto): Promise<void> {
    await this.prisma.$transaction((tx) => this.anexarEm(tx, conversaId, [mensagem]));
  }

  async definirPendencia(conversaId: string, pendencia: PendenciaCopiloto | null): Promise<void> {
    await this.prisma.copilotoConversa.update({
      where: { id: conversaId },
      data: { pendencia: pendencia ? (pendencia as unknown as Prisma.InputJsonValue) : Prisma.DbNull, atualizadoEm: new Date() },
    });
  }

  async definirResumo(conversaId: string, resumo: ResumoConversa): Promise<void> {
    await this.prisma.copilotoConversa.update({
      where: { id: conversaId },
      data: { resumo: resumo as unknown as Prisma.InputJsonValue, atualizadoEm: new Date() },
    });
  }

  async atualizarOportunidade(conversaId: string, oportunidadeId: string): Promise<void> {
    await this.prisma.copilotoConversa.update({
      where: { id: conversaId },
      data: { oportunidadeId, atualizadoEm: new Date() },
    });
  }

  async registrarConfirmacao(conversaId: string, confirmacao: ConfirmacaoCopiloto): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.copilotoConfirmacao.createMany({
        data: [{
          conversaId,
          callId: confirmacao.callId,
          tool: confirmacao.tool,
          decisao: confirmacao.decisao,
          resultado: json(confirmacao.resultado),
          erro: confirmacao.erro ?? null,
          concluidaEm: confirmacao.concluidaEm,
        }],
        skipDuplicates: true,
      }),
      this.prisma.copilotoConversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } }),
    ]);
  }

  async confirmarPendencia(conversaId: string, callId: string): Promise<PendenciaCopiloto | null> {
    return this.prisma.$transaction(async (tx) => {
      const linhas = await tx.$queryRaw<{ pendencia: PendenciaCopiloto | null }[]>`
        SELECT pendencia FROM copiloto_conversas WHERE id = ${conversaId} FOR UPDATE`;
      const pendencia = linhas[0]?.pendencia ?? null;
      if (!pendencia || pendencia.callId !== callId || pendencia.executando === true) return null;
      const executando: PendenciaCopiloto = { ...pendencia, executando: true };
      await tx.copilotoConversa.update({
        where: { id: conversaId },
        data: { pendencia: executando as unknown as Prisma.InputJsonValue, atualizadoEm: new Date() },
      });
      return executando;
    });
  }

  async buscarConfirmacao(conversaId: string, callId: string): Promise<ConfirmacaoCopiloto | null> {
    const linha = await this.prisma.copilotoConfirmacao.findUnique({
      where: { conversaId_callId: { conversaId, callId } },
    });
    if (!linha) return null;
    return {
      callId: linha.callId,
      tool: linha.tool,
      decisao: linha.decisao as ConfirmacaoCopiloto['decisao'],
      ...(linha.resultado !== null ? { resultado: linha.resultado } : {}),
      ...(linha.erro !== null ? { erro: linha.erro } : {}),
      concluidaEm: linha.concluidaEm,
    };
  }

  async anexarConclusaoGeracao(
    usuarioId: string,
    jobId: string,
    curriculo: Record<string, unknown>,
    narracao: MensagensNarracao,
    dados: DadosNarracao,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const candidatas = await tx.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM copiloto_conversas c
         WHERE c.usuario_id = ${usuarioId}
           AND EXISTS (SELECT 1 FROM copiloto_mensagens m
                        WHERE m.conversa_id = c.id AND m.tool = 'gerar_curriculo'
                          AND m.dados -> 'resultado' ->> 'jobId' = ${jobId})
         ORDER BY c.atualizado_em DESC
         LIMIT 1
         FOR UPDATE`;
      const conversaId = candidatas[0]?.id;
      if (!conversaId) return false;
      const jaAnexada = await tx.$queryRaw<{ existe: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM copiloto_mensagens m
                        WHERE m.conversa_id = ${conversaId}
                          AND m.dados ->> 'origem' = 'geracao_assincrona'
                          AND m.dados ->> 'jobId' = ${jobId}) AS existe`;
      if (jaAnexada[0]?.existe) return false;
      const callId = randomUUID();
      await this.anexarEm(tx, conversaId, [
        {
          papel: 'tool',
          tool: 'buscar_curriculo',
          conteudo: JSON.stringify(curriculo),
          dados: {
            callId,
            efeito: 'leitura',
            args: { curriculoId: curriculo.id },
            ok: true,
            resultado: curriculo,
            origem: 'geracao_assincrona',
            jobId,
          },
        },
        {
          papel: 'assistant',
          conteudo: narracao.etapa1,
          dados: { origem: 'geracao_assincrona', jobId, etapa: 1, narracao: dados },
        },
        {
          papel: 'assistant',
          conteudo: narracao.etapa3,
          dados: { origem: 'geracao_assincrona', jobId, etapa: 3 },
        },
      ]);
      return true;
    });
  }

  private async anexarEm(tx: Transacao, conversaId: string, mensagens: MensagemCopiloto[]): Promise<void> {
    const conversa = await tx.copilotoConversa.update({
      where: { id: conversaId },
      data: { totalMensagens: { increment: mensagens.length }, atualizadoEm: new Date() },
      select: { totalMensagens: true },
    });
    const primeira = conversa.totalMensagens - mensagens.length;
    await tx.copilotoMensagem.createMany({
      data: mensagens.map((mensagem, indice) => ({
        conversaId,
        ordem: primeira + indice,
        papel: mensagem.papel,
        conteudo: mensagem.conteudo,
        tool: mensagem.tool ?? null,
        blocos: json(mensagem.blocos),
        dados: json(mensagem.dados),
      })),
    });
  }

  private montar(
    conversa: {
      id: string;
      usuarioId: string;
      modo: ModoCopiloto;
      oportunidadeId: string | null;
      pendencia: Prisma.JsonValue;
      resumo: Prisma.JsonValue;
      criadoEm: Date;
      atualizadoEm: Date;
    },
    mensagens: MensagemCopiloto[],
    inicioJanela: number,
  ): ConversaCopiloto {
    return {
      id: conversa.id,
      usuarioId: conversa.usuarioId,
      modo: conversa.modo,
      oportunidadeId: conversa.oportunidadeId,
      inicioJanela,
      mensagens,
      pendencia: (conversa.pendencia as unknown as PendenciaCopiloto | null) ?? null,
      resumo: (conversa.resumo as unknown as ResumoConversa | null) ?? null,
      criadoEm: conversa.criadoEm,
      atualizadoEm: conversa.atualizadoEm,
    };
  }
}
