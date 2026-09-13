import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LotesService } from './lotes.service';

@UseGuards(JwtAuthGuard)
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  @Get(':id')
  status(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lotes.status(user.userId, id);
  }
}
