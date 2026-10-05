import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineFiltrosDto } from './pipeline.dto';
import { PipelineService } from './pipeline.service';

@UseGuards(JwtAuthGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser, @Query() filtros: PipelineFiltrosDto) {
    return this.pipeline.listar(user.userId, filtros);
  }

  @Get('grafo')
  grafo(@CurrentUser() user: AuthUser, @Query() filtros: PipelineFiltrosDto) {
    return this.pipeline.grafo(user.userId, filtros);
  }
}
