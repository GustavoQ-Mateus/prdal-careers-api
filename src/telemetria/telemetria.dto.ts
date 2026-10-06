import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const EVENTOS_TELEMETRIA = ['copiloto_primeira_mensagem', 'copiloto_acao_rapida'] as const;

export const ACOES_RAPIDAS = [
  'preparar_envio',
  'redigir_mensagem',
  'redigir_resposta',
  'preparar_entrevista',
  'preparar_curriculo',
  'definir_proximo_passo',
  'abrir_oportunidade',
  'analisar_vaga',
  'montar_perfil',
  'retomar_conversa',
  'ver_agenda',
  'abrir_curriculo',
  'colar_vaga_nova',
  'priorizar_vagas',
  'importar_vagas_lote',
] as const;

export const SESSAO_ID_PADRAO = '^[A-Za-z0-9_-]{1,64}$';

export class TelemetriaEventoDto {
  @ApiProperty({ enum: EVENTOS_TELEMETRIA })
  @IsIn(EVENTOS_TELEMETRIA)
  evento!: (typeof EVENTOS_TELEMETRIA)[number];

  @ApiProperty({ minLength: 1, maxLength: 64, pattern: SESSAO_ID_PADRAO })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(new RegExp(SESSAO_ID_PADRAO))
  sessaoId!: string;

  @ApiPropertyOptional({ enum: ACOES_RAPIDAS })
  @ValidateIf((dto: TelemetriaEventoDto) => dto.evento === 'copiloto_acao_rapida' || dto.acao !== undefined)
  @IsIn(ACOES_RAPIDAS)
  acao?: (typeof ACOES_RAPIDAS)[number];
}
