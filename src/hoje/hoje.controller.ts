import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PatchPreferenciasDto } from './hoje.dto';
import { HojeService } from './hoje.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class HojeController {
  constructor(private readonly hoje: HojeService) {}

  @Get('hoje')
  agenda(
    @CurrentUser() user: AuthUser,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Headers('x-timezone') fusoDetectado?: string,
  ) {
    return this.hoje.garantirPreferencia(user.userId, fusoDetectado).then(() =>
      this.hoje.agenda(user.userId, de, ate),
    );
  }

  @Get('preferencias')
  preferencias(
    @CurrentUser() user: AuthUser,
    @Headers('x-timezone') fusoDetectado?: string,
  ) {
    return this.hoje.preferencias(user.userId, fusoDetectado);
  }

  @Patch('preferencias')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchPreferenciasDto,
  ) {
    return this.hoje.atualizar(user.userId, dto.fusoHorario);
  }
}
