import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineFiltrosDto, SalvarCanvasDto } from './pipeline.dto';
import { PipelineService } from './pipeline.service';

@UseGuards(JwtAuthGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser, @Query() filtros: PipelineFiltrosDto) {
    return this.pipeline.listar(user.userId, filtros);
  }

  @Get('canvas')
  canvas(@CurrentUser() user: AuthUser) {
    return this.pipeline.canvas(user.userId);
  }

  @Put('canvas')
  salvarCanvas(@CurrentUser() user: AuthUser, @Body() dto: SalvarCanvasDto) {
    return this.pipeline.salvarCanvas(user.userId, dto);
  }

  @Get('grafo')
  grafo(@CurrentUser() user: AuthUser, @Query() filtros: PipelineFiltrosDto) {
    return this.pipeline.grafo(user.userId, filtros);
  }
}
