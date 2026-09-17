import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Candidatura,
  Prisma,
  StatusCandidatura,
  Vaga,
} from '@prisma/client';
import { AiClient } from '../clients/ai.client';
import {
  apresentacaoRelacional,
  etapaPipeline,
} from '../dominio/apresentacao';
import {
  DestinoTransicao,
  origemTransicao,
  STATUS_ATIVOS,
  transicaoPermitida,
} from '../dominio/transicoes';
import { EventosService } from '../eventos/eventos.service';
import { BancoVagaDoc, MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AtualizarOportunidadeDto,
  CriarOportunidadeDto,
} from './oportunidade.dto';

type VagaComPrincipal = Vaga & {
  candidaturas: Candidatura[];
  curriculos: { id: string; rotulo: string; score: number | null; geradoEm: Date }[];
  acoes: {
    id: string;
    titulo: string;
    tipo: string;
    principal: boolean;
    venceEm: Date | null;
    lembrarEm: Date | null;
    concluidaEm: Date | null;
    canceladaEm: Date | null;
  }[];
  eventos: { ocorridoEm: Date }[];
};

@Injectable()
export class OportunidadesService {
  private readonly logger = new Logger(OportunidadesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly ai: AiClient,
    private readonly eventos: EventosService,
  ) {}

  private async classificar(titulo: string, descricao: string) {
    try {
      return await this.ai.classify(titulo, descricao);
    } catch (err) {
      this.logger.warn(`classificacao indisponivel: ${(err as Error).message}`);
      return null;
    }
  }

  async criar(usuarioId: string, dto: CriarOportunidadeDto) {
    const keywords = await this.ai.keywords(dto.descricao);
    const taxonomia = await this.classificar(dto.titulo, dto.descricao);
    return this.prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.create({
        data: {
          ...dto,
          usuarioId,
          origem: 'MANUAL',
          keywords: keywords as unknown as Prisma.InputJsonValue,
          ...(taxonomia
            ? { categoria: taxonomia.categoria, nivel: taxonomia.nivel }
            : {}),
        },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: vaga.id,
        tipo: 'OPORTUNIDADE_CRIADA',
        origem: 'SISTEMA',
        descricao: 'Oportunidade registrada',
        dados: { origem: 'MANUAL' },
      });
      return vaga;
    });
  }

  async listar(
    usuarioId: string,
    query: {
      visao?: string;
      busca?: string;
      categoria?: string;
      nivel?: string;
      prioridade?: string;
      ordenarPor?: string;
    },
  ) {
    const visao = (query.visao ?? 'ativas').toLowerCase();
    if (visao === 'entrada') {
      return this.listarEntradas(usuarioId, query);
    }

    const vagas = await this.prisma.vaga.findMany({
      where: {
        usuarioId,
        ...(query.categoria ? { categoria: query.categoria } : {}),
        ...(query.nivel ? { nivel: query.nivel } : {}),
        ...(query.prioridade
          ? { prioridade: query.prioridade as Vaga['prioridade'] }
          : {}),
        ...(query.busca
          ? {
              OR: [
                { titulo: { contains: query.busca, mode: 'insensitive' } },
                { empresa: { contains: query.busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        candidaturas: { where: { principal: true } },
        curriculos: {
          orderBy: { geradoEm: 'desc' },
          take: 1,
          select: { id: true, rotulo: true, score: true, geradoEm: true },
        },
        acoes: {
          where: { principal: true, concluidaEm: null, canceladaEm: null },
        },
        eventos: {
          orderBy: { ocorridoEm: 'desc' },
          take: 1,
          select: { ocorridoEm: true },
        },
      },
    });

    const itens = vagas
      .map((vaga) => this.resumo(vaga))
      .filter((item) =>
        visao === 'encerradas'
          ? item.apresentacao === 'ENCERRADA'
          : item.apresentacao === 'ATIVA',
      );

    return this.ordenar(itens, query.ordenarPor);
  }

  async buscar(usuarioId: string, id: string) {
    const vaga = await this.carregar(usuarioId, id);
    return this.detalhe(vaga);
  }

  async atualizar(usuarioId: string, id: string, dto: AtualizarOportunidadeDto) {
    const atual = await this.garantirVaga(usuarioId, id);
    const keywords = dto.descricao
      ? await this.ai.keywords(dto.descricao)
      : undefined;
    const mudouTexto =
      (dto.titulo !== undefined && dto.titulo !== atual.titulo) ||
      (dto.descricao !== undefined && dto.descricao !== atual.descricao);
    const taxonomia = mudouTexto
      ? await this.classificar(
          dto.titulo ?? atual.titulo,
          dto.descricao ?? atual.descricao,
        )
      : null;
    const mudouPrioridade =
      dto.prioridade !== undefined && dto.prioridade !== atual.prioridade;
    const arquivar = dto.arquivar;

    return this.prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.update({
        where: { id },
        data: {
          ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
          ...(dto.empresa !== undefined ? { empresa: dto.empresa } : {}),
          ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
          ...(dto.fonte !== undefined ? { fonte: dto.fonte } : {}),
          ...(dto.prioridade !== undefined ? { prioridade: dto.prioridade } : {}),
          ...(keywords
            ? { keywords: keywords as unknown as Prisma.InputJsonValue }
            : {}),
          ...(taxonomia
            ? { categoria: taxonomia.categoria, nivel: taxonomia.nivel }
            : {}),
          ...(arquivar === true && !atual.arquivadaEm
            ? { arquivadaEm: new Date() }
            : {}),
          ...(arquivar === false ? { arquivadaEm: null } : {}),
        },
      });

      if (dto.titulo || dto.empresa || dto.descricao || dto.fonte) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: id,
          tipo: 'OPORTUNIDADE_EDITADA',
          origem: 'SISTEMA',
          descricao: 'Oportunidade editada',
          dados: {
            campos: Object.keys(dto).filter((k) => k !== 'arquivar' && k !== 'prioridade'),
          },
        });
      }
      if (mudouPrioridade) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: id,
          tipo: 'OPORTUNIDADE_PRIORIZADA',
          origem: 'SISTEMA',
          descricao: 'Prioridade alterada',
          dados: { de: atual.prioridade, para: dto.prioridade },
        });
      }
      if (arquivar === true && !atual.arquivadaEm) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: id,
          tipo: 'OPORTUNIDADE_ARQUIVADA',
          origem: 'SISTEMA',
          descricao: 'Oportunidade arquivada',
        });
      }
      if (arquivar === false && atual.arquivadaEm) {
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId: id,
          tipo: 'OPORTUNIDADE_REABERTA',
          origem: 'SISTEMA',
          descricao: 'Oportunidade reaberta',
        });
      }
      return vaga;
    });
  }

  async ativarEntrada(usuarioId: string, entradaId: string) {
    const existente = await this.prisma.vaga.findFirst({
      where: { usuarioId, origemImportacaoId: entradaId },
    });
    if (existente) {
      await this.vincularEntrada(entradaId, usuarioId, existente.id);
      return existente;
    }

    const doc = await this.mongo
      .bancoVagas()
      .findOne({ _id: entradaId, usuarioId });
    if (!doc) throw new NotFoundException('entrada nao encontrada');

    const vaga = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.vaga.create({
        data: {
          usuarioId,
          titulo: doc.titulo,
          empresa: doc.empresa,
          descricao: doc.descricao,
          fonte: doc.fonte,
          keywords: (doc.keywords ?? []) as unknown as Prisma.InputJsonValue,
          categoria: doc.categoria,
          nivel: doc.nivel,
          origem: 'IMPORTACAO',
          origemImportacaoId: entradaId,
        },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId: criada.id,
        tipo: 'OPORTUNIDADE_ATIVADA',
        origem: 'SISTEMA',
        descricao: 'Entrada ativada',
        dados: { entradaId },
      });
      return criada;
    });

    await this.vincularEntrada(entradaId, usuarioId, vaga.id);
    return vaga;
  }

  async workspace(usuarioId: string, id: string) {
    const vaga = await this.carregar(usuarioId, id, 40);
    const candidatura = vaga.candidaturas[0] ?? null;
    const curriculoVinculado = candidatura?.curriculoId
      ? vaga.curriculos.find((c) => c.id === candidatura.curriculoId)
      : null;
    const acaoPrincipal =
      vaga.acoes.find((a) => a.principal && !a.concluidaEm && !a.canceladaEm) ??
      null;
    const timeline = await this.prisma.eventoOportunidade.findMany({
      where: { usuarioId, vagaId: id },
      orderBy: { ocorridoEm: 'desc' },
      take: 20,
    });
    return {
      oportunidade: this.detalhe(vaga),
      candidatura: candidatura
        ? this.resumoCandidatura(candidatura, curriculoVinculado)
        : null,
      curriculos: vaga.curriculos.map((c) => ({
        id: c.id,
        rotulo: c.rotulo,
        score: c.score,
        geradoEm: c.geradoEm,
      })),
      acaoPrincipal,
      acoes: vaga.acoes,
      timeline,
    };
  }

  async candidaturaPrincipal(usuarioId: string, vagaId: string) {
    await this.garantirVaga(usuarioId, vagaId);
    const existente = await this.prisma.candidatura.findFirst({
      where: { vagaId, principal: true },
    });
    if (existente) return existente;

    return this.prisma.$transaction(async (tx) => {
      const criada = await tx.candidatura.create({
        data: { vagaId, principal: true },
      });
      await this.eventos.registrar(tx, {
        usuarioId,
        vagaId,
        candidaturaId: criada.id,
        tipo: 'CANDIDATURA_CRIADA',
        origem: 'SISTEMA',
        descricao: 'Candidatura principal criada',
      });
      return criada;
    });
  }

  async transicionar(
    usuarioId: string,
    vagaId: string,
    destino: DestinoTransicao,
    motivo?: string,
  ) {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: vagaId, usuarioId },
      include: { candidaturas: { where: { principal: true } } },
    });
    if (!vaga) throw new NotFoundException('oportunidade nao encontrada');

    const principal = vaga.candidaturas[0] ?? null;
    const origem = origemTransicao(vaga.arquivadaEm, principal?.status ?? null);
    if (!transicaoPermitida(origem, destino)) {
      throw new ConflictException('transicao nao permitida');
    }

    const agora = new Date();
    const resultado = await this.prisma.$transaction(async (tx) => {
      let candidatura = principal;

      if (destino === 'ARQUIVADA') {
        await tx.vaga.update({
          where: { id: vagaId },
          data: { arquivadaEm: vaga.arquivadaEm ?? agora },
        });
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId,
          candidaturaId: candidatura?.id,
          tipo: 'OPORTUNIDADE_ARQUIVADA',
          origem: 'SISTEMA',
          descricao: 'Oportunidade arquivada',
          dados: motivo ? { motivo } : {},
        });
      } else if (destino === 'REABRIR') {
        await tx.vaga.update({
          where: { id: vagaId },
          data: { arquivadaEm: null },
        });
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId,
          candidaturaId: candidatura?.id,
          tipo: 'OPORTUNIDADE_REABERTA',
          origem: 'SISTEMA',
          descricao: 'Oportunidade reaberta',
        });
      } else if (destino === 'PREPARACAO') {
        if (!candidatura) {
          candidatura = await tx.candidatura.create({
            data: { vagaId, principal: true, status: 'RASCUNHO' },
          });
          await this.eventos.registrar(tx, {
            usuarioId,
            vagaId,
            candidaturaId: candidatura.id,
            tipo: 'CANDIDATURA_CRIADA',
            origem: 'SISTEMA',
            descricao: 'Candidatura em preparacao',
          });
        } else if (origem === 'INSCRITA') {
          candidatura = await tx.candidatura.update({
            where: { id: candidatura.id },
            data: { status: 'RASCUNHO', enviadaEm: null },
          });
        } else if (origem === 'REJEITADA' || origem === 'DESISTIU') {
          await tx.candidatura.update({
            where: { id: candidatura.id },
            data: { principal: false },
          });
          candidatura = await tx.candidatura.create({
            data: { vagaId, principal: true, status: 'RASCUNHO' },
          });
          await this.eventos.registrar(tx, {
            usuarioId,
            vagaId,
            candidaturaId: candidatura.id,
            tipo: 'CANDIDATURA_CRIADA',
            origem: 'SISTEMA',
            descricao: 'Nova candidatura principal apos reabertura',
          });
        }
      } else {
        if (!candidatura) {
          if (STATUS_ATIVOS.includes(destino as StatusCandidatura)) {
            throw new ConflictException('candidatura principal obrigatoria');
          }
          candidatura = await tx.candidatura.create({
            data: { vagaId, principal: true, status: 'RASCUNHO' },
          });
          await this.eventos.registrar(tx, {
            usuarioId,
            vagaId,
            candidaturaId: candidatura.id,
            tipo: 'CANDIDATURA_CRIADA',
            origem: 'SISTEMA',
            descricao: 'Candidatura principal criada',
          });
        }

        const status = destino as StatusCandidatura;
        const extra: Prisma.CandidaturaUpdateInput = { status };
        if (status === 'INSCRITA' && !candidatura.enviadaEm) {
          extra.enviadaEm = agora;
        }
        if (status === 'REJEITADA' || status === 'DESISTIU') {
          extra.encerradaEm = agora;
          extra.motivoEncerramento = motivo ?? null;
        }
        const anterior = candidatura.status;
        candidatura = await tx.candidatura.update({
          where: { id: candidatura.id },
          data: extra,
        });
        await this.eventos.registrar(tx, {
          usuarioId,
          vagaId,
          candidaturaId: candidatura.id,
          tipo: 'CANDIDATURA_STATUS',
          origem: 'SISTEMA',
          descricao: 'Status da candidatura alterado',
          dados: { de: anterior, para: status },
        });
      }

      const atualizada = await tx.vaga.findUniqueOrThrow({
        where: { id: vagaId },
        include: { candidaturas: { where: { principal: true } } },
      });
      const evento = await tx.eventoOportunidade.findFirst({
        where: { vagaId },
        orderBy: { registradoEm: 'desc' },
      });
      return {
        oportunidade: atualizada,
        candidatura: atualizada.candidaturas[0] ?? null,
        evento,
      };
    });

    return resultado;
  }

  async timeline(usuarioId: string, vagaId: string, cursor?: string, limite = 30) {
    await this.garantirVaga(usuarioId, vagaId);
    const take = Math.min(Math.max(limite, 1), 100);
    const itens = await this.prisma.eventoOportunidade.findMany({
      where: {
        usuarioId,
        vagaId,
        ...(cursor ? { ocorridoEm: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { ocorridoEm: 'desc' },
      take: take + 1,
    });
    const temMais = itens.length > take;
    const pagina = temMais ? itens.slice(0, take) : itens;
    return {
      itens: pagina,
      proximoCursor: temMais
        ? pagina[pagina.length - 1].ocorridoEm.toISOString()
        : null,
    };
  }

  async registrarNota(usuarioId: string, vagaId: string, descricao: string) {
    await this.garantirVaga(usuarioId, vagaId);
    return this.prisma.$transaction(async (tx) =>
      this.eventos.registrar(tx, {
        usuarioId,
        vagaId,
        tipo: 'NOTA_MANUAL',
        origem: 'USUARIO',
        descricao,
      }),
    );
  }

  private async listarEntradas(
    usuarioId: string,
    query: { busca?: string; categoria?: string; nivel?: string },
  ) {
    const filtro: Record<string, unknown> = { usuarioId, status: 'CRUA' };
    if (query.categoria) filtro.categoria = query.categoria;
    if (query.nivel) filtro.nivel = query.nivel;
    const docs = await this.mongo
      .bancoVagas()
      .find(filtro)
      .sort({ criadoEm: -1 })
      .toArray();
    return docs
      .filter((d) => this.casaBusca(d, query.busca))
      .map((d) => ({
        tipo: 'ENTRADA' as const,
        id: d._id,
        titulo: d.titulo,
        empresa: d.empresa,
        categoria: d.categoria,
        nivel: d.nivel,
        prioridade: null,
        etapa: null,
        apresentacao: 'ENTRADA' as const,
        curriculoVinculado: null,
        score: null,
        proximoPasso: null,
        ultimaAtividade: d.criadoEm,
        origem: 'IMPORTACAO' as const,
        keywords: d.keywords ?? [],
      }));
  }

  private casaBusca(doc: BancoVagaDoc, busca?: string) {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      doc.titulo.toLowerCase().includes(q) ||
      doc.empresa.toLowerCase().includes(q)
    );
  }

  private resumo(vaga: VagaComPrincipal) {
    const candidatura = vaga.candidaturas[0] ?? null;
    const curriculo =
      (candidatura?.curriculoId
        ? vaga.curriculos.find((c) => c.id === candidatura.curriculoId)
        : null) ?? vaga.curriculos[0] ?? null;
    const proximoPasso =
      vaga.acoes.find((a) => a.principal && !a.concluidaEm && !a.canceladaEm) ??
      null;
    return {
      tipo: 'OPORTUNIDADE' as const,
      id: vaga.id,
      titulo: vaga.titulo,
      empresa: vaga.empresa,
      categoria: vaga.categoria,
      nivel: vaga.nivel,
      prioridade: vaga.prioridade,
      etapa: etapaPipeline(vaga.arquivadaEm, candidatura?.status ?? null),
      apresentacao: apresentacaoRelacional(
        vaga.arquivadaEm,
        candidatura?.status ?? null,
      ),
      curriculoVinculado: curriculo
        ? { id: curriculo.id, rotulo: curriculo.rotulo, score: curriculo.score }
        : null,
      score: curriculo?.score ?? null,
      proximoPasso,
      ultimaAtividade: vaga.eventos[0]?.ocorridoEm ?? vaga.atualizadoEm,
      origem: vaga.origem,
      keywords: vaga.keywords,
      statusCandidatura: candidatura?.status ?? null,
      arquivadaEm: vaga.arquivadaEm,
    };
  }

  private detalhe(vaga: VagaComPrincipal) {
    return {
      ...this.resumo(vaga),
      descricao: vaga.descricao,
      fonte: vaga.fonte,
      criadoEm: vaga.criadoEm,
      atualizadoEm: vaga.atualizadoEm,
    };
  }

  private resumoCandidatura(
    candidatura: Candidatura,
    curriculo?: { id: string; rotulo: string; score: number | null } | null,
  ) {
    return {
      id: candidatura.id,
      status: candidatura.status,
      notas: candidatura.notas,
      principal: candidatura.principal,
      enviadaEm: candidatura.enviadaEm,
      encerradaEm: candidatura.encerradaEm,
      motivoEncerramento: candidatura.motivoEncerramento,
      curriculoId: candidatura.curriculoId,
      vinculo: curriculo
        ? {
            curriculoId: curriculo.id,
            rotulo: curriculo.rotulo,
            score: curriculo.score,
            situacao: 'VINCULADO',
          }
        : candidatura.curriculoId
          ? { curriculoId: candidatura.curriculoId, situacao: 'AUSENTE' }
          : { curriculoId: null, situacao: 'NAO_REGISTRADO' },
    };
  }

  private ordenar(
    itens: ReturnType<OportunidadesService['resumo']>[],
    ordenarPor?: string,
  ) {
    const peso = { BAIXA: 1, MEDIA: 2, ALTA: 3 };
    const copia = [...itens];
    switch (ordenarPor) {
      case 'prioridade':
        copia.sort((a, b) => (peso[b.prioridade] ?? 0) - (peso[a.prioridade] ?? 0));
        break;
      case 'score':
        copia.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
        break;
      case 'keywords':
        copia.sort(
          (a, b) =>
            (Array.isArray(b.keywords) ? b.keywords.length : 0) -
            (Array.isArray(a.keywords) ? a.keywords.length : 0),
        );
        break;
      case 'etapa':
        copia.sort((a, b) => (a.etapa ?? '').localeCompare(b.etapa ?? ''));
        break;
      case 'prazo':
        copia.sort((a, b) => {
          const ta = a.proximoPasso?.venceEm
            ? new Date(a.proximoPasso.venceEm).getTime()
            : Number.MAX_SAFE_INTEGER;
          const tb = b.proximoPasso?.venceEm
            ? new Date(b.proximoPasso.venceEm).getTime()
            : Number.MAX_SAFE_INTEGER;
          return ta - tb;
        });
        break;
      default:
        copia.sort(
          (a, b) =>
            new Date(b.ultimaAtividade).getTime() -
            new Date(a.ultimaAtividade).getTime(),
        );
    }
    return copia;
  }

  private async carregar(usuarioId: string, id: string, acoes = 20) {
    const vaga = await this.prisma.vaga.findFirst({
      where: { id, usuarioId },
      include: {
        candidaturas: { where: { principal: true } },
        curriculos: { orderBy: { geradoEm: 'desc' } },
        acoes: { orderBy: { criadoEm: 'desc' }, take: acoes },
        eventos: {
          orderBy: { ocorridoEm: 'desc' },
          take: 1,
          select: { ocorridoEm: true },
        },
      },
    });
    if (!vaga) throw new NotFoundException('oportunidade nao encontrada');
    return vaga;
  }

  async garantirVaga(usuarioId: string, id: string) {
    const vaga = await this.prisma.vaga.findFirst({ where: { id, usuarioId } });
    if (!vaga) throw new NotFoundException('oportunidade nao encontrada');
    return vaga;
  }

  private async vincularEntrada(
    entradaId: string,
    usuarioId: string,
    vagaId: string,
  ) {
    await this.mongo.bancoVagas().updateOne(
      { _id: entradaId, usuarioId },
      { $set: { status: 'ATIVADA', origemRelacionalId: vagaId } },
    );
  }
}
