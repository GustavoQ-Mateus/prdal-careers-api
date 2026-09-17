import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiClient } from '../clients/ai.client';

@UseGuards(JwtAuthGuard)
@Controller('taxonomia')
export class TaxonomiaController {
  constructor(private readonly ai: AiClient) {}

  @Get()
  listar() {
    return this.ai.taxonomy();
  }
}
