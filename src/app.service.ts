import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import type { HelloHop, HelloResponse } from '@prdal/shared-types';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

  constructor(private readonly http: HttpService) {}

  async hello(): Promise<HelloResponse> {
    const hop: HelloHop = { service: 'api', message: 'hello from api' };
    const { data } = await firstValueFrom(
      this.http.get<HelloResponse>(`${this.aiServiceUrl}/hello`),
    );
    return {
      service: 'api',
      message: hop.message,
      chain: [hop, ...data.chain],
    };
  }
}
