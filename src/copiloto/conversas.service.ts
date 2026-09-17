import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ConversaCopilotoDoc,
  MensagemCopiloto,
  MongoService,
  PendenciaCopiloto,
} from '../mongo/mongo.service';

@Injectable()
export class ConversasService {
  constructor(private readonly mongo: MongoService) {}

  async abrir(
    usuarioId: string,
    conversaId: string | undefined,
    modo: 'assistido' | 'autopiloto',
    oportunidadeId: string | null,
  ): Promise<ConversaCopilotoDoc> {
    if (conversaId) {
      const existente = await this.mongo
        .conversasCopiloto()
        .findOne({ _id: conversaId, usuarioId });
      if (!existente) throw new NotFoundException('conversa nao encontrada');
      const atualizacoes: Partial<ConversaCopilotoDoc> = { modo };
      if (oportunidadeId) atualizacoes.oportunidadeId = oportunidadeId;
      existente.modo = modo;
      if (oportunidadeId) existente.oportunidadeId = oportunidadeId;
      await this.mongo
        .conversasCopiloto()
        .updateOne({ _id: conversaId }, { $set: atualizacoes });
      return existente;
    }

    const agora = new Date();
    const nova: ConversaCopilotoDoc = {
      _id: randomUUID(),
      usuarioId,
      modo,
      oportunidadeId,
      mensagens: [],
      pendencia: null,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    await this.mongo.conversasCopiloto().insertOne(nova);
    return nova;
  }

  async anexar(conversaId: string, mensagem: MensagemCopiloto): Promise<void> {
    await this.mongo.conversasCopiloto().updateOne(
      { _id: conversaId },
      {
        $push: { mensagens: mensagem },
        $set: { atualizadoEm: new Date() },
      },
    );
  }

  async definirPendencia(
    conversaId: string,
    pendencia: PendenciaCopiloto | null,
  ): Promise<void> {
    await this.mongo
      .conversasCopiloto()
      .updateOne(
        { _id: conversaId },
        { $set: { pendencia, atualizadoEm: new Date() } },
      );
  }

  async atualizarOportunidade(conversaId: string, oportunidadeId: string) {
    await this.mongo.conversasCopiloto().updateOne(
      { _id: conversaId },
      { $set: { oportunidadeId, atualizadoEm: new Date() } },
    );
  }

  async registrarConfirmacao(
    conversaId: string,
    confirmacao: import('../mongo/mongo.service').ConfirmacaoCopiloto,
  ) {
    await this.mongo.conversasCopiloto().updateOne(
      { _id: conversaId },
      { $push: { confirmacoes: confirmacao }, $set: { atualizadoEm: new Date() } },
    );
  }

  async confirmarPendencia(conversaId: string, callId: string) {
    const resultado = await this.mongo.conversasCopiloto().findOneAndUpdate(
      { _id: conversaId, 'pendencia.callId': callId, 'pendencia.executando': { $ne: true } },
      { $set: { 'pendencia.executando': true, atualizadoEm: new Date() } },
      { returnDocument: 'after' },
    );
    return resultado?.pendencia ?? null;
  }

  async buscarConfirmacao(conversaId: string, callId: string) {
    const conversa = await this.mongo.conversasCopiloto().findOne({ _id: conversaId });
    return conversa?.confirmacoes?.find((item) => item.callId === callId) ?? null;
  }
}
