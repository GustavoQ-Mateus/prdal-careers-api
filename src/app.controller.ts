import { Controller, Get } from '@nestjs/common';
import type { HelloResponse } from '@prdal/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  hello(): Promise<HelloResponse> {
    return this.appService.hello();
  }
}
