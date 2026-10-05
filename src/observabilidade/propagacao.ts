import type { HttpService } from '@nestjs/axios';
import { HEADER_REQUEST_ID, requestIdAtual } from './contexto';

export function propagarRequestId(http: HttpService): void {
  http.axiosRef.interceptors.request.use((config) => {
    const requestId = requestIdAtual();
    if (requestId) config.headers.set(HEADER_REQUEST_ID, requestId);
    return config;
  });
}
