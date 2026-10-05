import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthResponse } from '@prdal/contracts';
import { Prontidao, SaudeService } from './saude.service';

@Controller()
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  @Get('health')
  health(): HealthResponse {
    return { service: 'api', status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Prontidao> {
    const prontidao = await this.saude.prontidao();
    res.status(prontidao.status === 'pronto' ? 200 : 503);
    return prontidao;
  }
}
