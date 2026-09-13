import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DocClient {
  private readonly baseUrl =
    process.env.DOC_SERVICE_URL ?? 'http://localhost:8080';

  constructor(private readonly http: HttpService) {}

  async renderDocx(markdown: string): Promise<Buffer> {
    return this.render('docx', markdown);
  }

  async renderPdf(markdown: string): Promise<Buffer> {
    return this.render('pdf', markdown);
  }

  private async render(formato: 'docx' | 'pdf', markdown: string): Promise<Buffer> {
    const { data } = await firstValueFrom(
      this.http.post<ArrayBuffer>(
        `${this.baseUrl}/render/${formato}`,
        { markdown },
        { responseType: 'arraybuffer' },
      ),
    );
    return Buffer.from(data);
  }
}
