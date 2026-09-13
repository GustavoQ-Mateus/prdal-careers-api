import { Controller, Get } from '@nestjs/common';
import type { HealthResponse, HelloResponse } from '@prdal/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health(): HealthResponse {
    return { service: 'api', status: 'ok' };
  }

  @Get('hello')
  hello(): Promise<HelloResponse> {
    return this.appService.hello();
  }
}
