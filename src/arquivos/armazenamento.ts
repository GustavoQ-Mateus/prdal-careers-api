import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const VALIDADE_MAXIMA_S = 300;

export interface UrlDeDownload {
  url: string;
  expiraEm: string;
}

export abstract class Armazenamento {
  abstract gravar(chave: string, dados: Buffer, tipoConteudo: string): Promise<string>;
  abstract ler(chave: string): Promise<Buffer>;
  abstract urlDeDownload(chave: string, nomeArquivo: string): Promise<UrlDeDownload>;
  abstract verificar(): Promise<void>;
}

type Env = Record<string, string | undefined>;

export function configuracaoS3(env: Env = process.env) {
  const bucket = env.S3_BUCKET?.trim();
  if (!bucket) throw new Error('S3_BUCKET ausente; defina o bucket dos arquivos de curriculo');
  const endpoint = env.S3_ENDPOINT?.trim() || undefined;
  const endpointPublico = env.S3_ENDPOINT_PUBLICO?.trim() || endpoint;
  const validade = Number(env.S3_URL_VALIDADE_S);
  return {
    bucket,
    endpoint,
    endpointPublico,
    regiao: env.AWS_REGION?.trim() || 'us-east-1',
    validadeS: Number.isInteger(validade) && validade > 0 ? Math.min(validade, VALIDADE_MAXIMA_S) : VALIDADE_MAXIMA_S,
  };
}

export function chaveDoCurriculo(usuarioId: string, curriculoId: string, extensao: 'pdf' | 'docx' | 'zip'): string {
  return `usuarios/${usuarioId}/curriculos/${curriculoId}.${extensao}`;
}

export function disposicaoAnexo(nomeArquivo: string): string {
  const ascii = nomeArquivo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim() || 'arquivo';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`;
}

function cliente(regiao: string, endpoint: string | undefined): S3Client {
  return new S3Client({ region: regiao, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });
}

export class ArmazenamentoS3 extends Armazenamento {
  private conexao: { interno: S3Client; publico: S3Client; config: ReturnType<typeof configuracaoS3> } | null = null;

  constructor(private readonly env: Env = process.env) {
    super();
  }

  private conectar() {
    if (!this.conexao) {
      const config = configuracaoS3(this.env);
      this.conexao = { config, interno: cliente(config.regiao, config.endpoint), publico: cliente(config.regiao, config.endpointPublico) };
    }
    return this.conexao;
  }

  async gravar(chave: string, dados: Buffer, tipoConteudo: string): Promise<string> {
    const { interno, config } = this.conectar();
    await interno.send(new PutObjectCommand({ Bucket: config.bucket, Key: chave, Body: dados, ContentType: tipoConteudo }));
    return chave;
  }

  async ler(chave: string): Promise<Buffer> {
    const { interno, config } = this.conectar();
    const resposta = await interno.send(new GetObjectCommand({ Bucket: config.bucket, Key: chave }));
    return Buffer.from(await resposta.Body!.transformToByteArray());
  }

  async urlDeDownload(chave: string, nomeArquivo: string): Promise<UrlDeDownload> {
    const { publico, config } = this.conectar();
    const url = await getSignedUrl(
      publico,
      new GetObjectCommand({ Bucket: config.bucket, Key: chave, ResponseContentDisposition: disposicaoAnexo(nomeArquivo) }),
      { expiresIn: config.validadeS },
    );
    return { url, expiraEm: new Date(Date.now() + config.validadeS * 1000).toISOString() };
  }

  async verificar(): Promise<void> {
    const { interno, config } = this.conectar();
    await interno.send(new HeadBucketCommand({ Bucket: config.bucket }));
  }
}
