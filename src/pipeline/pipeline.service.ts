import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrioridadeOportunidade, StatusCandidatura } from '@prisma/client';
import { apresentacaoRelacional, etapaPipeline } from '../dominio/apresentacao';
import { normalizar } from '../dominio/normalizar';
import { HojeService } from '../hoje/hoje.service';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineFiltrosDto, SalvarCanvasDto } from './pipeline.dto';

export const GRAFO_SCHEMA_VERSION = '1';

type VagaPipeline = {
  id: string;
  titulo: string;
  empresa: string;
  categoria: string | null;
  nivel: string | null;
  prioridade: PrioridadeOportunidade;
  keywords: Prisma.JsonValue;
  arquivadaEm: Date | null;
  atualizadoEm: Date;
  candidaturas: Prisma.CandidaturaGetPayload<object>[];
  curriculos: Prisma.CurriculoGetPayload<object>[];
  acoes: Prisma.AcaoOportunidadeGetPayload<object>[];
  eventos: { ocorridoEm: Date }[];
};

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly hoje: HojeService,
  ) {}

  async listar(usuarioId: string, filtros: PipelineFiltrosDto) {
    const itens = await this.conjunto(usuarioId, filtros);
    return this.ordenar(
      itens.map((vaga) => this.resumo(vaga)),
      filtros.ordenarPor,
      filtros.ordenarDirecao,
    );
  }

  async canvas(usuarioId: string) {
    const pref = await this.hoje.garantirPreferencia(usuarioId);
    const posicoes = await this.prisma.pipelineLayout.findMany({
      where: { usuarioId, modo: 'canvas' },
      select: { vagaId: true, posX: true, posY: true },
    });
    return {
      revisao: pref.canvasRevisao,
      viewport: { x: pref.canvasX, y: pref.canvasY, zoom: pref.canvasZoom },
      posicoes: posicoes.map((p) => ({ vagaId: p.vagaId, x: p.posX, y: p.posY })),
    };
  }

  async salvarCanvas(usuarioId: string, dto: SalvarCanvasDto) {
    const pref = await this.hoje.garantirPreferencia(usuarioId);
    if (dto.revisaoBase !== pref.canvasRevisao) {
      throw new ConflictException('layout desatualizado');
    }
    const vagas = await this.prisma.vaga.findMany({
      where: { usuarioId, id: { in: dto.posicoes.map((p) => p.vagaId) } },
      select: { id: true },
    });
    const permitidas = new Set(vagas.map((v) => v.id));

    return this.prisma.$transaction(async (tx) => {
      await tx.pipelineLayout.deleteMany({
        where: { usuarioId, modo: 'canvas' },
      });
      if (dto.posicoes.length) {
        await tx.pipelineLayout.createMany({
          data: dto.posicoes
            .filter((p) => permitidas.has(p.vagaId))
            .map((p) => ({
              usuarioId,
              vagaId: p.vagaId,
              modo: 'canvas',
              posX: p.x,
              posY: p.y,
            })),
        });
      }
      const atualizada = await tx.preferenciaUsuario.update({
        where: { usuarioId },
        data: {
          canvasX: dto.viewport.x,
          canvasY: dto.viewport.y,
          canvasZoom: dto.viewport.zoom,
          canvasRevisao: { increment: 1 },
        },
      });
      return {
        revisao: atualizada.canvasRevisao,
        viewport: {
          x: atualizada.canvasX,
          y: atualizada.canvasY,
          zoom: atualizada.canvasZoom,
        },
        posicoes: dto.posicoes.filter((p) => permitidas.has(p.vagaId)),
      };
    });
  }

  async grafo(usuarioId: string, filtros: PipelineFiltrosDto) {
    const vagas = await this.conjunto(usuarioId, filtros);
    const porId = new Map(vagas.map((vaga) => [vaga.id, vaga]));
    const vagasOrdenadas = this.ordenar(
      vagas.map((vaga) => this.resumo(vaga)),
      filtros.ordenarPor,
      filtros.ordenarDirecao,
    ).map((resumo) => porId.get(resumo.id)).filter((vaga): vaga is NonNullable<typeof vaga> => Boolean(vaga));
    const perfil = await this.prisma.perfilMestre.findUnique({
      where: { usuarioId },
    });
    const notas = await this.mongo
      .notasObsidian()
      .find({ usuarioId })
      .toArray();

    const nodes = new Map<string, { id: string; tipo: string; rotulo: string }>();
    const edges: { id: string; origem: string; destino: string; tipo: string }[] = [];
    const addNode = (id: string, tipo: string, rotulo: string) => {
      if (!nodes.has(id)) nodes.set(id, { id, tipo, rotulo });
    };
    const addEdge = (origem: string, destino: string, tipo: string) => {
      const id = `${tipo}:${origem}->${destino}`;
      if (!edges.some((e) => e.id === id)) {
        edges.push({ id, origem, destino, tipo });
      }
    };

    const facets = {
      empresas: new Set<string>(),
      categorias: new Set<string>(),
      niveis: new Set<string>(),
      skills: new Set<string>(),
    };

    if (perfil) {
      addNode(`perfil:${usuarioId}`, 'perfil', perfil.nome);
      for (const skill of (perfil.skills as string[]) ?? []) {
        const chave = normalizar(skill);
        if (!chave) continue;
        const skillId = `skill:${chave}`;
        addNode(skillId, 'skill', skill);
        addEdge(`perfil:${usuarioId}`, skillId, 'perfil-skill');
        facets.skills.add(skill);
      }
    }

    for (const vaga of vagasOrdenadas) {
      const oppId = `oportunidade:${vaga.id}`;
      addNode(oppId, 'oportunidade', `${vaga.titulo} · ${vaga.empresa}`);
      const empChave = normalizar(vaga.empresa);
      if (empChave) {
        const empId = `empresa:${empChave}`;
        addNode(empId, 'empresa', vaga.empresa);
        addEdge(oppId, empId, 'oportunidade-empresa');
        facets.empresas.add(vaga.empresa);
      }
      if (vaga.categoria) {
        const catChave = normalizar(vaga.categoria);
        const catId = `categoria:${catChave}`;
        addNode(catId, 'categoria', vaga.categoria);
        addEdge(oppId, catId, 'oportunidade-categoria');
        facets.categorias.add(vaga.categoria);
      }
      if (vaga.nivel) {
        const nivChave = normalizar(vaga.nivel);
        const nivId = `nivel:${nivChave}`;
        addNode(nivId, 'nivel', vaga.nivel);
        addEdge(oppId, nivId, 'oportunidade-nivel');
        facets.niveis.add(vaga.nivel);
      }
      const keywords = (vaga.keywords as { termo?: string }[]) ?? [];
      for (const kw of keywords) {
        const termo = kw.termo ?? '';
        const chave = normalizar(termo);
        if (!chave) continue;
        const skillId = `skill:${chave}`;
        addNode(skillId, 'skill', termo);
        addEdge(oppId, skillId, 'oportunidade-skill');
        facets.skills.add(termo);
        for (const nota of notas) {
          const tituloN = normalizar(nota.titulo);
          const corpoN = normalizar(nota.corpo);
          if (tituloN.includes(chave) || corpoN.includes(chave)) {
            const notaId = `conhecimento:nota:${nota._id}`;
            addNode(notaId, 'conhecimento', nota.titulo);
            addEdge(oppId, notaId, 'oportunidade-nota');
          }
        }
      }
      for (const curriculo of vaga.curriculos) {
        const cvId = `curriculo:${curriculo.id}`;
        addNode(cvId, 'curriculo', curriculo.rotulo);
        addEdge(oppId, cvId, 'oportunidade-curriculo');
        const vinculada = vaga.candidaturas.find(
          (c) => c.curriculoId === curriculo.id,
        );
        if (vinculada) {
          addEdge(cvId, oppId, 'curriculo-candidatura');
        }
      }
      for (const candidatura of vaga.candidaturas) {
        if (candidatura.notas.trim()) {
          const docId = `conhecimento:candidatura:${candidatura.id}`;
          addNode(docId, 'conhecimento', `Notas · ${vaga.titulo}`);
          addEdge(oppId, docId, 'candidatura-conhecimento');
        }
      }
    }

    if (nodes.size > 500 || edges.length > 1000) {
      throw new ConflictException(
        'grafo acima do orcamento de 500 nos e 1000 arestas; aplique filtros',
      );
    }

    return {
      schemaVersion: GRAFO_SCHEMA_VERSION,
      nodes: [...nodes.values()],
      edges,
      facets: {
        empresas: [...facets.empresas].sort(),
        categorias: [...facets.categorias].sort(),
        niveis: [...facets.niveis].sort(),
        skills: [...facets.skills].sort(),
      },
    };
  }

  private async conjunto(usuarioId: string, filtros: PipelineFiltrosDto) {
    const vagas = await this.prisma.vaga.findMany({
      where: {
        usuarioId,
        ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
        ...(filtros.nivel ? { nivel: filtros.nivel } : {}),
        ...(filtros.empresa
          ? { empresa: { contains: filtros.empresa, mode: 'insensitive' } }
          : {}),
        ...(filtros.prioridade
          ? { prioridade: filtros.prioridade as PrioridadeOportunidade }
          : {}),
        ...(filtros.busca
          ? {
              OR: [
                { titulo: { contains: filtros.busca, mode: 'insensitive' } },
                { empresa: { contains: filtros.busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        candidaturas: { where: { principal: true } },
        curriculos: { orderBy: { geradoEm: 'desc' } },
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

    return vagas.filter((vaga) => this.passaFiltro(vaga, filtros));
  }

  private passaFiltro(vaga: VagaPipeline, filtros: PipelineFiltrosDto) {
    const candidatura = vaga.candidaturas[0] ?? null;
    const apresentacao = apresentacaoRelacional(
      vaga.arquivadaEm,
      candidatura?.status ?? null,
    );
    if (filtros.apresentacao && apresentacao !== filtros.apresentacao) {
      return false;
    }
    if (
      filtros.statusCandidatura &&
      candidatura?.status !== (filtros.statusCandidatura as StatusCandidatura)
    ) {
      return false;
    }
    const temCurriculo = vaga.curriculos.length > 0;
    if (filtros.comCurriculo === 'true' && !temCurriculo) return false;
    if (filtros.comCurriculo === 'false' && temCurriculo) return false;
    const score = vaga.curriculos[0]?.score ?? null;
    if (filtros.scoreMinimo !== undefined && (score ?? -1) < filtros.scoreMinimo) {
      return false;
    }
    if (filtros.prazo) {
      const limite = new Date(filtros.prazo);
      const vence = vaga.acoes[0]?.venceEm;
      if (!vence || vence > limite) return false;
    }
    if (filtros.atividadeDesde) {
      const desde = new Date(filtros.atividadeDesde);
      const ultima = vaga.eventos[0]?.ocorridoEm ?? vaga.atualizadoEm;
      if (ultima < desde) return false;
    }
    return true;
  }

  private resumo(vaga: VagaPipeline) {
    const candidatura = vaga.candidaturas[0] ?? null;
    const curriculo = candidatura?.curriculoId
      ? vaga.curriculos.find((c) => c.id === candidatura.curriculoId)
      : vaga.curriculos[0];
    return {
      id: vaga.id,
      titulo: vaga.titulo,
      empresa: vaga.empresa,
      categoria: vaga.categoria,
      nivel: vaga.nivel,
      prioridade: vaga.prioridade,
      apresentacao: apresentacaoRelacional(
        vaga.arquivadaEm,
        candidatura?.status ?? null,
      ),
      etapa: etapaPipeline(vaga.arquivadaEm, candidatura?.status ?? null),
      statusCandidatura: candidatura?.status ?? null,
      arquivadaEm: vaga.arquivadaEm,
      score: curriculo?.score ?? null,
      curriculo: curriculo
        ? { id: curriculo.id, rotulo: curriculo.rotulo, score: curriculo.score }
        : null,
      proximoPasso: vaga.acoes[0] ?? null,
      ultimaAtividade: vaga.eventos[0]?.ocorridoEm ?? vaga.atualizadoEm,
      keywords: vaga.keywords,
    };
  }

  private ordenar(
    itens: ReturnType<PipelineService['resumo']>[],
    ordenarPor?: string,
    ordenarDirecao?: string,
  ) {
    const peso = { BAIXA: 1, MEDIA: 2, ALTA: 3 };
    const copia = [...itens];
    const multiplicador = ordenarDirecao
      ? ordenarDirecao === 'asc' ? 1 : -1
      : ordenarPor === 'etapa' || ordenarPor === 'prazo' ? 1 : -1;
    switch (ordenarPor) {
      case 'prioridade':
        copia.sort((a, b) => multiplicador * ((peso[b.prioridade] ?? 0) - (peso[a.prioridade] ?? 0)));
        break;
      case 'score':
        copia.sort((a, b) => multiplicador * ((b.score ?? -1) - (a.score ?? -1)));
        break;
      case 'keywords':
        copia.sort((a, b) => multiplicador * ((Array.isArray(b.keywords) ? b.keywords.length : 0) - (Array.isArray(a.keywords) ? a.keywords.length : 0)));
        break;
      case 'etapa':
        copia.sort((a, b) => multiplicador * a.etapa.localeCompare(b.etapa));
        break;
      case 'prazo':
        copia.sort((a, b) => {
          const ta = a.proximoPasso?.venceEm
            ? new Date(a.proximoPasso.venceEm).getTime()
            : Number.MAX_SAFE_INTEGER;
          const tb = b.proximoPasso?.venceEm
            ? new Date(b.proximoPasso.venceEm).getTime()
            : Number.MAX_SAFE_INTEGER;
          return multiplicador * (ta - tb);
        });
        break;
      default:
        copia.sort(
          (a, b) => multiplicador * (
            new Date(b.ultimaAtividade).getTime() -
            new Date(a.ultimaAtividade).getTime()
          ),
        );
    }
    return copia;
  }
}
