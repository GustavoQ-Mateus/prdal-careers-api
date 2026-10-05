import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversasRepositorio } from '../repositorios/conversas.repositorio';
import {
  ConfirmacaoCopiloto,
  ConversaCopiloto,
  MensagemCopiloto,
  ModoCopiloto,
  PendenciaCopiloto,
  ResumoConversa,
} from '../repositorios/tipos';

@Injectable()
export class ConversasService {
  constructor(private readonly repositorio: ConversasRepositorio) {}

  async listar(usuarioId: string, oportunidadeId?: string) {
    const conversas = await this.repositorio.listar(usuarioId, oportunidadeId);
    return conversas.map((conversa) => ({
      id: conversa.id,
      modo: conversa.modo,
      oportunidadeId: conversa.oportunidadeId,
      titulo: this.tituloConversa(conversa.primeiraDoCandidato ?? conversa.ultimaComTexto ?? undefined),
      ultimaMensagem: this.tituloConversa(conversa.ultimaComTexto ?? undefined),
      totalMensagens: conversa.totalMensagens,
      criadoEm: conversa.criadoEm,
      atualizadoEm: conversa.atualizadoEm,
    }));
  }

  async buscar(usuarioId: string, conversaId: string) {
    const conversa = await this.repositorio.buscarCompleta(usuarioId, conversaId);
    if (!conversa) throw new NotFoundException('conversa nao encontrada');
    return {
      id: conversa.id,
      modo: conversa.modo,
      oportunidadeId: conversa.oportunidadeId,
      mensagens: conversa.mensagens,
      pendencia: conversa.pendencia,
      criadoEm: conversa.criadoEm,
      atualizadoEm: conversa.atualizadoEm,
    };
  }

  async abrir(
    usuarioId: string,
    conversaId: string | undefined,
    modo: ModoCopiloto,
    oportunidadeId: string | null,
  ): Promise<ConversaCopiloto> {
    if (!conversaId) return this.repositorio.criar(usuarioId, modo, oportunidadeId);
    const existente = await this.repositorio.abrirJanela(usuarioId, conversaId);
    if (!existente) throw new NotFoundException('conversa nao encontrada');
    await this.repositorio.atualizarModo(conversaId, modo, oportunidadeId);
    existente.modo = modo;
    if (oportunidadeId) existente.oportunidadeId = oportunidadeId;
    return existente;
  }

  async anexar(conversaId: string, mensagem: MensagemCopiloto): Promise<void> {
    await this.repositorio.anexar(conversaId, mensagem);
  }

  async definirPendencia(conversaId: string, pendencia: PendenciaCopiloto | null): Promise<void> {
    await this.repositorio.definirPendencia(conversaId, pendencia);
  }

  async definirResumo(conversaId: string, resumo: ResumoConversa): Promise<void> {
    await this.repositorio.definirResumo(conversaId, resumo);
  }

  async atualizarOportunidade(conversaId: string, oportunidadeId: string) {
    await this.repositorio.atualizarOportunidade(conversaId, oportunidadeId);
  }

  async registrarConfirmacao(conversaId: string, confirmacao: ConfirmacaoCopiloto) {
    await this.repositorio.registrarConfirmacao(conversaId, confirmacao);
  }

  async confirmarPendencia(conversaId: string, callId: string) {
    return this.repositorio.confirmarPendencia(conversaId, callId);
  }

  async buscarConfirmacao(conversaId: string, callId: string) {
    return this.repositorio.buscarConfirmacao(conversaId, callId);
  }

  private tituloConversa(texto?: string): string {
    const limpo = String(texto ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    return limpo ? limpo.slice(0, 96) : 'Conversa sem título';
  }
}
