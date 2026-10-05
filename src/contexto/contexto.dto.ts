import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadContextoDto {
  @ApiPropertyOptional({ type: 'array', items: { type: 'string', format: 'binary' } })
  arquivos?: string[];

  @ApiPropertyOptional({ oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false', ''] }], nullable: true })
  historico?: unknown;
}
