import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BancoVagasService } from '../banco-vagas/banco-vagas.service';
import { CurriculosService } from '../curriculos/curriculos.service';
import {
  AtualizarOportunidadeDto,
  CriarOportunidadeDto,
  ImportarOportunidadesDto,
  NotaTimelineDto,
  TransicaoDto,
} from './oportunidade.dto';
import { OportunidadesService } from './oportunidades.service';

function numeroPaginacao(valor: string | undefined, nome: 'limit' | 'offset') {
  if (valor === undefined) return undefined;
  const numero = Number(valor);
  const minimo = nome === 'limit' ? 1 : 0;
  if (!Number.isInteger(numero) || numero < minimo) {
    throw new BadRequestException(`${nome} invalido`);
  }
  return numero;
}

@UseGuards(JwtAuthGuard)
@Controller('oportunidades')
export class OportunidadesController {
  constructor(
    private readonly oportunidades: OportunidadesService,
    private readonly banco: BancoVagasService,
    private readonly curriculos: CurriculosService,
  ) {}

  @Get()
  listar(
    @CurrentUser() user: AuthUser,
    @Query('visao') visao?: string,
    @Query('busca') busca?: string,
    @Query('categoria') categoria?: string,
    @Query('nivel') nivel?: string,
    @Query('prioridade') prioridade?: string,
    @Query('ordenarPor') ordenarPor?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.oportunidades.listar(user.userId, {
      visao,
      busca,
      categoria,
      nivel,
      prioridade,
      ordenarPor,
      limit: numeroPaginacao(limit, 'limit'),
      offset: numeroPaginacao(offset, 'offset'),
    });
  }

  @Post()
  criar(@CurrentUser() user: AuthUser, @Body() dto: CriarOportunidadeDto) {
    return this.oportunidades.criar(user.userId, dto);
  }

  @Post('importar')
  importar(@CurrentUser() user: AuthUser, @Body() dto: ImportarOportunidadesDto) {
    return this.banco.importar(user.userId, dto);
  }

  @Post('entradas/:id/ativar')
  ativar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.oportunidades.ativarEntrada(user.userId, id);
  }

  @Get(':id/workspace')
  workspace(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.oportunidades.workspace(user.userId, id);
  }

  @Get(':id/timeline')
  timeline(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limite') limite?: string,
  ) {
    return this.oportunidades.timeline(
      user.userId,
      id,
      cursor,
      limite ? Number(limite) : 30,
    );
  }

  @Post(':id/timeline/notas')
  nota(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NotaTimelineDto,
  ) {
    return this.oportunidades.registrarNota(user.userId, id, dto.descricao);
  }

  @Post(':id/candidatura-principal')
  candidaturaPrincipal(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.oportunidades.candidaturaPrincipal(user.userId, id);
  }

  @Post(':id/transicoes')
  transicionar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TransicaoDto,
  ) {
    return this.oportunidades.transicionar(
      user.userId,
      id,
      dto.destino,
      dto.motivo,
    );
  }

  @Post(':id/gerar-cv')
  @HttpCode(202)
  gerarCv(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.curriculos.gerar(user.userId, id);
  }

  @Get(':id')
  buscar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.oportunidades.buscar(user.userId, id);
  }

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AtualizarOportunidadeDto,
  ) {
    return this.oportunidades.atualizar(user.userId, id, dto);
  }
}
