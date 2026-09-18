import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DocClient {
  private readonly baseUrl =
    process.env.DOC_SERVICE_URL ?? 'http://localhost:8080';

  constructor(private readonly http: HttpService) {}

  async renderDocx(markdown: string, template?: string): Promise<Buffer> {
    return this.render('docx', markdown, template);
  }

  async renderPdf(markdown: string, template?: string): Promise<Buffer> {
    return this.render('pdf', markdown, template);
  }

  private async render(
    formato: 'docx' | 'pdf',
    markdown: string,
    template?: string,
  ): Promise<Buffer> {
    const { data } = await firstValueFrom(
      this.http.post<ArrayBuffer>(
        `${this.baseUrl}/render/${formato}`,
        { markdown, template },
        { responseType: 'arraybuffer' },
      ),
    );
    return Buffer.from(data);
  }
}
