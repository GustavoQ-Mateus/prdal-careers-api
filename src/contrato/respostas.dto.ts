import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespostaObjeto1Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "usuarioId"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "candidaturaId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string","enum":["REVISAR_VAGA","GERAR_CURRICULO","ENVIAR_CANDIDATURA","FAZER_FOLLOW_UP","PREPARAR_ENTREVISTA","PARTICIPAR_ENTREVISTA","ENVIAR_MATERIAL","OUTRO"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "venceEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "lembrarEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "lembreteEnviadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "concluidaEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "canceladaEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

}

export class RespostaObjeto2Dto {
  @ApiProperty({"type":"string","enum":["cadastro recebido; entre com seu e-mail e senha"]})
  "mensagem"!: unknown;

}

export class RespostaObjeto3Dto {
  @ApiProperty({ ...{}, type: () => RespostaObjeto4Dto })
  "usuario"!: unknown;

  @ApiProperty({"type":"string"})
  "csrfToken"!: unknown;

}

export class RespostaObjeto4Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "email"!: unknown;

}

export class RespostaObjeto5Dto {
  @ApiProperty({"type":"string"})
  "csrfToken"!: unknown;

}

export class RespostaObjeto6Dto {
  @ApiProperty({ ...{}, type: () => RespostaObjeto7Dto })
  "usuario"!: unknown;

  @ApiProperty({"type":"string"})
  "csrfToken"!: unknown;

}

export class RespostaObjeto7Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "email"!: unknown;

}

export class RespostaObjeto8Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "status"!: unknown;

  @ApiProperty({"type":"string"})
  "notas"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "enviadaEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "encerradaEm"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "motivoEncerramento"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "curriculoId"!: unknown;

}

export class RespostaObjeto9Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string"})
  "tituloVaga"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "curriculoId"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "status"!: unknown;

  @ApiProperty({"type":"string"})
  "notas"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto10Dto })
  "curriculo"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto11Dto })
  "proximoPasso"!: unknown;

}

export class RespostaObjeto10Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

}

export class RespostaObjeto11Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "venceEm"!: unknown;

}

export class RespostaObjeto12Dto {
  @ApiProperty({"type":"string"})
  "email"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto13Dto })
  "consentimento"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "exclusaoAgendadaPara"!: unknown;

}

export class RespostaObjeto13Dto {
  @ApiProperty({"type":"string","nullable":true})
  "aceitoEm"!: unknown;

  @ApiProperty({"type":"string"})
  "provedor"!: unknown;

  @ApiProperty({"type":"string"})
  "regiao"!: unknown;

}

export class RespostaObjeto14Dto {
  @ApiProperty({"type":"string"})
  "jobId"!: unknown;

}

export class RespostaObjeto15Dto {
  @ApiProperty({"type":"string","enum":["PENDENTE","PROCESSANDO","ERRO"]})
  "status"!: unknown;

}

export class RespostaObjeto16Dto {
  @ApiProperty({"type":"string","enum":["CONCLUIDO"]})
  "status"!: unknown;

  @ApiProperty({"type":"string"})
  "url"!: unknown;

  @ApiProperty({"type":"string"})
  "expiraEm"!: unknown;

}

export class RespostaObjeto17Dto {
  @ApiProperty({"type":"string"})
  "exclusaoAgendadaPara"!: unknown;

}

export class RespostaObjeto18Dto {
  @ApiProperty({"type":"string"})
  "loteId"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

}

export class RespostaObjeto19Dto {
  @ApiProperty({"type":"string"})
  "loteId"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

}

export class RespostaObjeto20Dto {
  @ApiProperty({"type":"number"})
  "documentos"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "ultimaIndexacao"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto21Dto })
  "porOrigem"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "disponivel"!: unknown;

}

export class RespostaObjeto21Dto {
  @ApiProperty({"type":"number"})
  "perfil"!: unknown;

  @ApiProperty({"type":"number"})
  "candidatura"!: unknown;

  @ApiProperty({"type":"number"})
  "nota"!: unknown;

}

export class RespostaObjeto22Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string","enum":["assistido","autopiloto"]})
  "modo"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "oportunidadeId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "ultimaMensagem"!: unknown;

  @ApiProperty({"type":"number"})
  "totalMensagens"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

}

export class RespostaObjeto23Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string","enum":["assistido","autopiloto"]})
  "modo"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "oportunidadeId"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto24Dto"}})
  "mensagens"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto34Dto })
  "pendencia"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

}

export class RespostaObjeto24Dto {
  @ApiProperty({"type":"string","enum":["user","assistant","tool","evento"]})
  "papel"!: unknown;

  @ApiProperty({"type":"string"})
  "conteudo"!: unknown;

  @ApiPropertyOptional({"type":"string","nullable":true})
  "tool"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"oneOf":[{"$ref":"#/components/schemas/RespostaObjeto25Dto"},{"$ref":"#/components/schemas/RespostaObjeto26Dto"},{"$ref":"#/components/schemas/RespostaObjeto27Dto"},{"$ref":"#/components/schemas/RespostaObjeto28Dto"},{"$ref":"#/components/schemas/RespostaObjeto29Dto"}]}})
  "blocos"!: unknown;

  @ApiPropertyOptional({ ...{}, type: () => RespostaObjeto30Dto })
  "dados"!: unknown;

}

export class RespostaObjeto25Dto {
  @ApiProperty({"type":"string","enum":["text"]})
  "type"!: unknown;

  @ApiProperty({"type":"string"})
  "text"!: unknown;

}

export class RespostaObjeto26Dto {
  @ApiProperty({"type":"string","enum":["tool_use"]})
  "type"!: unknown;

  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "name"!: unknown;

  @ApiProperty({"type":"object","additionalProperties":{"oneOf":[{}]}})
  "input"!: unknown;

}

export class RespostaObjeto27Dto {
  @ApiProperty({"type":"string","enum":["tool_result"]})
  "type"!: unknown;

  @ApiProperty({"type":"string"})
  "tool_use_id"!: unknown;

  @ApiProperty({"type":"string"})
  "content"!: unknown;

  @ApiPropertyOptional({"type":"boolean","enum":[false,true]})
  "is_error"!: unknown;

}

export class RespostaObjeto28Dto {
  @ApiProperty({"type":"string","enum":["thinking"]})
  "type"!: unknown;

  @ApiProperty({"type":"string"})
  "thinking"!: unknown;

  @ApiProperty({"type":"string"})
  "signature"!: unknown;

}

export class RespostaObjeto29Dto {
  @ApiProperty({"type":"string","enum":["redacted_thinking"]})
  "type"!: unknown;

  @ApiProperty({"type":"string"})
  "data"!: unknown;

}

export class RespostaObjeto30Dto {
  @ApiPropertyOptional({"type":"string"})
  "callId"!: unknown;

  @ApiPropertyOptional({"type":"string","enum":["leitura","escrita","entrega_externa"]})
  "efeito"!: unknown;

  @ApiPropertyOptional({"type":"object","additionalProperties":{"oneOf":[{}]}})
  "args"!: unknown;

  @ApiPropertyOptional({"type":"boolean","enum":[false,true]})
  "ok"!: unknown;

  @ApiPropertyOptional({"oneOf":[{}]})
  "resultado"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "erro"!: unknown;

  @ApiPropertyOptional({ ...{}, type: () => RespostaObjeto31Dto })
  "entrega"!: unknown;

  @ApiPropertyOptional({"type":"string","enum":["erro","cancelado"]})
  "evento"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "escopo"!: unknown;

  @ApiPropertyOptional({"type":"string","enum":["geracao_assincrona"]})
  "origem"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "jobId"!: unknown;

  @ApiPropertyOptional({"type":"number","enum":[1,3]})
  "etapa"!: unknown;

  @ApiPropertyOptional({ ...{}, type: () => RespostaObjeto33Dto })
  "narracao"!: unknown;

}

export class RespostaObjeto31Dto {
  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "texto"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "destino"!: unknown;

  @ApiPropertyOptional({ ...{}, type: () => AvisoAcao })
  "aviso"!: unknown;

}

export class AvisoAcao {
  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "mensagem"!: unknown;

  @ApiProperty({"type":"string"})
  "sugestao"!: unknown;

}

export class RespostaObjeto33Dto {
  @ApiProperty({"type":"number"})
  "scoreInicial"!: unknown;

  @ApiProperty({"type":"number"})
  "scoreFinal"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsEncontradas"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsAusentesIniciais"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "pontosDeAtencao"!: unknown;

  @ApiProperty({"type":"string"})
  "veredicto"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsCobertas"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsAusentes"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "degradacao"!: unknown;

}

export class RespostaObjeto34Dto {
  @ApiProperty({"type":"string"})
  "callId"!: unknown;

  @ApiProperty({"type":"string"})
  "tool"!: unknown;

  @ApiProperty({"type":"string","enum":["escrita"]})
  "efeito"!: unknown;

  @ApiProperty({"type":"object","additionalProperties":{"oneOf":[{}]}})
  "args"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "resumo"!: unknown;

  @ApiPropertyOptional({"type":"boolean","enum":[false,true]})
  "executando"!: unknown;

}

export class RespostaObjeto35Dto {
  @ApiProperty({"type":"string","enum":["mensagem_recrutador"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "texto"!: unknown;

  @ApiProperty({"type":"string"})
  "destino"!: unknown;

}

export class RespostaObjeto36Dto {
  @ApiProperty({"type":"string","enum":["resposta_formulario"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto37Dto"}})
  "respostas"!: unknown;

  @ApiProperty({"type":"string"})
  "texto"!: unknown;

}

export class RespostaObjeto37Dto {
  @ApiProperty({"type":"string"})
  "campo"!: unknown;

  @ApiProperty({"type":"string"})
  "texto"!: unknown;

}

export class RespostaObjeto38Dto {
  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto39Dto"}})
  "itens"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "limit"!: unknown;

  @ApiProperty({"type":"number"})
  "offset"!: unknown;

}

export class RespostaObjeto39Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => ScoreBreakdown })
  "breakdown"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseInicial"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseFinal"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "degradacao"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "geradoEm"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto42Dto })
  "oportunidade"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto43Dto })
  "vinculo"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "downloadDocxUrl"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "downloadPdfUrl"!: unknown;

}

export class ScoreBreakdown {
  @ApiProperty({"type":"number"})
  "keywordMatch"!: unknown;

  @ApiProperty({"type":"number"})
  "densidade"!: unknown;

  @ApiProperty({"type":"number"})
  "secoes"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "faltando"!: unknown;

}

export class AtsAnalysis {
  @ApiProperty({"type":"number"})
  "score"!: unknown;

  @ApiPropertyOptional({"type":"number"})
  "scoreVersao"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsEncontradas"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsCriticasAusentes"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "pontosEliminatorios"!: unknown;

  @ApiProperty({"type":"string"})
  "veredicto"!: unknown;

  @ApiProperty({ ...{}, type: () => ScoreBreakdown })
  "breakdown"!: unknown;

}

export class RespostaObjeto42Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

}

export class RespostaObjeto43Dto {
  @ApiProperty({"type":"string"})
  "candidaturaId"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "status"!: unknown;

}

export class RespostaObjeto44Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","ERRO","ANALISANDO","GERANDO","VALIDANDO","CONCLUIDA"]})
  "status"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "erro"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "curriculoId"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto45Dto })
  "etapas"!: unknown;

}

export class RespostaObjeto45Dto {
  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseInicial"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "reescrita"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseFinal"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "degradacao"!: unknown;

}

export class RespostaObjeto46Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"string"})
  "markdown"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => ScoreBreakdown })
  "breakdown"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseInicial"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseFinal"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "degradacao"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "geradoEm"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto47Dto })
  "oportunidade"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto48Dto })
  "vinculo"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "downloadDocxUrl"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "downloadPdfUrl"!: unknown;

}

export class RespostaObjeto47Dto {
}

export class RespostaObjeto48Dto {
}

export class RespostaObjeto49Dto {
  @ApiProperty({"type":"string"})
  "url"!: unknown;

  @ApiProperty({"type":"string"})
  "expiraEm"!: unknown;

}

export class RespostaObjeto50Dto {
  @ApiProperty({"type":"string"})
  "fusoHorario"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "inicioDia"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "fimDia"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto51Dto"}})
  "atrasadas"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto51Dto"}})
  "hoje"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto51Dto"}})
  "proximosDias"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto53Dto"}})
  "semProximoPasso"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto54Dto"}})
  "atividadeRecente"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto55Dto })
  "resumoAts"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto56Dto })
  "serieTemporal"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto58Dto"}})
  "geracoesConcluidas"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto59Dto"}})
  "entrada"!: unknown;

}

export class RespostaObjeto51Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "venceEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "lembrarEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "quando"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto52Dto })
  "oportunidade"!: unknown;

}

export class RespostaObjeto52Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

}

export class RespostaObjeto53Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

}

export class RespostaObjeto54Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "ocorridoEm"!: unknown;

}

export class RespostaObjeto55Dto {
  @ApiProperty({"type":"number"})
  "curriculos"!: unknown;

  @ApiProperty({"type":"number"})
  "comScore"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "media"!: unknown;

}

export class RespostaObjeto56Dto {
  @ApiProperty({"type":"string"})
  "inicio"!: unknown;

  @ApiProperty({"type":"string"})
  "fim"!: unknown;

  @ApiProperty({"type":"number","enum":[7,30,90]})
  "periodoDias"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto57Dto"}})
  "pontos"!: unknown;

}

export class RespostaObjeto57Dto {
  @ApiProperty({"type":"string"})
  "data"!: unknown;

  @ApiProperty({"type":"number"})
  "oportunidadesCriadas"!: unknown;

  @ApiProperty({"type":"number"})
  "acoesConcluidas"!: unknown;

  @ApiProperty({"type":"number"})
  "curriculosGerados"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "scoreMedio"!: unknown;

}

export class RespostaObjeto58Dto {
  @ApiProperty({"type":"string"})
  "curriculoId"!: unknown;

  @ApiProperty({"type":"string"})
  "oportunidadeId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "concluidaEm"!: unknown;

}

export class RespostaObjeto59Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

}

export class RespostaObjeto60Dto {
  @ApiProperty({"type":"string"})
  "usuarioId"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({"type":"string"})
  "fusoHorario"!: unknown;

}

export class RespostaObjeto61Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","PROCESSANDO","CONCLUIDO"]})
  "status"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

  @ApiProperty({"type":"number"})
  "processados"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto62Dto"}})
  "itens"!: unknown;

}

export class RespostaObjeto62Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "bancoVagaId"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","PROCESSANDO","CONCLUIDO","ERRO"]})
  "status"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "erro"!: unknown;

}

export class RespostaObjeto63Dto {
  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto64Dto"}})
  "itens"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "limit"!: unknown;

  @ApiProperty({"type":"number"})
  "offset"!: unknown;

}

export class RespostaObjeto64Dto {
  @ApiProperty({"type":"string","enum":["ENTRADA"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "prioridade"!: unknown;

  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "etapa"!: unknown;

  @ApiProperty({"type":"string","enum":["ENTRADA"]})
  "apresentacao"!: unknown;

  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "curriculoVinculado"!: unknown;

  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "score"!: unknown;

  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "proximoPasso"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "ultimaAtividade"!: unknown;

  @ApiProperty({"type":"string","enum":["IMPORTACAO"]})
  "origem"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/Keyword"},"nullable":true})
  "keywords"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","VALIDAS"]})
  "keywordsStatus"!: unknown;

}

export class Keyword {
  @ApiProperty({"type":"string"})
  "termo"!: unknown;

  @ApiProperty({"type":"number"})
  "peso"!: unknown;

}

export class RespostaObjeto66Dto {
  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto67Dto"}})
  "itens"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

  @ApiProperty({"type":"number"})
  "limit"!: unknown;

  @ApiProperty({"type":"number"})
  "offset"!: unknown;

}

export class RespostaObjeto67Dto {
  @ApiProperty({"type":"string","enum":["OPORTUNIDADE"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({"type":"string","enum":["BAIXA","MEDIA","ALTA"]})
  "prioridade"!: unknown;

  @ApiProperty({"type":"string","enum":["INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","PREPARACAO","ENCERRADAS"]})
  "etapa"!: unknown;

  @ApiProperty({"type":"string","enum":["ENTRADA","ATIVA","ENCERRADA"]})
  "apresentacao"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto68Dto })
  "curriculoVinculado"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto69Dto })
  "proximoPasso"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "ultimaAtividade"!: unknown;

  @ApiProperty({"type":"string","enum":["MANUAL","IMPORTACAO"]})
  "origem"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/Keyword"},"nullable":true})
  "keywords"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","VALIDAS"]})
  "keywordsStatus"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","ERRO","EXTRAINDO","PRONTAS"]})
  "keywordsExtracao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "keywordsErro"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "statusCandidatura"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "arquivadaEm"!: unknown;

}

export class RespostaObjeto68Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

}

export class RespostaObjeto69Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "venceEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "lembrarEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "concluidaEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "canceladaEm"!: unknown;

}

export class RespostaObjeto70Dto {
  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto67Dto"}})
  "itens"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "limit"!: unknown;

  @ApiProperty({"type":"number"})
  "offset"!: unknown;

}

export class RespostaObjeto71Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "usuarioId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "fonte"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/Keyword"},"nullable":true})
  "keywords"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","VALIDAS"]})
  "keywordsStatus"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","ERRO","EXTRAINDO","PRONTAS"]})
  "keywordsExtracao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "keywordsErro"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({"type":"string","enum":["BAIXA","MEDIA","ALTA"]})
  "prioridade"!: unknown;

  @ApiProperty({"type":"string","enum":["MANUAL","IMPORTACAO"]})
  "origem"!: unknown;

  @ApiProperty({"type":"string","enum":["ENTRADA","ATIVA"]})
  "estagio"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "origemImportacaoId"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "arquivadaEm"!: unknown;

}

export class RespostaObjeto72Dto {
  @ApiProperty({"type":"string"})
  "loteId"!: unknown;

  @ApiProperty({"type":"number"})
  "total"!: unknown;

}

export class RespostaObjeto73Dto {
  @ApiProperty({ ...{}, type: () => RespostaObjeto74Dto })
  "oportunidade"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto75Dto })
  "candidatura"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto79Dto"}})
  "curriculos"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto1Dto })
  "acaoPrincipal"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto1Dto"}})
  "acoes"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto80Dto"}})
  "timeline"!: unknown;

}

export class RespostaObjeto74Dto {
  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "fonte"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({"type":"string","enum":["OPORTUNIDADE"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({"type":"string","enum":["BAIXA","MEDIA","ALTA"]})
  "prioridade"!: unknown;

  @ApiProperty({"type":"string","enum":["INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","PREPARACAO","ENCERRADAS"]})
  "etapa"!: unknown;

  @ApiProperty({"type":"string","enum":["ENTRADA","ATIVA","ENCERRADA"]})
  "apresentacao"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto68Dto })
  "curriculoVinculado"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto69Dto })
  "proximoPasso"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "ultimaAtividade"!: unknown;

  @ApiProperty({"type":"string","enum":["MANUAL","IMPORTACAO"]})
  "origem"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/Keyword"},"nullable":true})
  "keywords"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","VALIDAS"]})
  "keywordsStatus"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","ERRO","EXTRAINDO","PRONTAS"]})
  "keywordsExtracao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "keywordsErro"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "statusCandidatura"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "arquivadaEm"!: unknown;

}

export class RespostaObjeto75Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "status"!: unknown;

  @ApiProperty({"type":"string"})
  "notas"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "enviadaEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "encerradaEm"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "motivoEncerramento"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "curriculoId"!: unknown;

  @ApiProperty({"oneOf":[{"$ref":"#/components/schemas/RespostaObjeto76Dto"},{"$ref":"#/components/schemas/RespostaObjeto77Dto"},{"$ref":"#/components/schemas/RespostaObjeto78Dto"}]})
  "vinculo"!: unknown;

}

export class RespostaObjeto76Dto {
  @ApiProperty({"type":"string"})
  "curriculoId"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({"type":"string"})
  "situacao"!: unknown;

}

export class RespostaObjeto77Dto {
  @ApiProperty({"type":"string"})
  "curriculoId"!: unknown;

  @ApiProperty({"type":"string"})
  "situacao"!: unknown;

}

export class RespostaObjeto78Dto {
  @ApiProperty({"type":"string","enum":[null],"nullable":true})
  "curriculoId"!: unknown;

  @ApiProperty({"type":"string"})
  "situacao"!: unknown;

}

export class RespostaObjeto79Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "geradoEm"!: unknown;

}

export class RespostaObjeto80Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "usuarioId"!: unknown;

  @ApiProperty({"type":"string"})
  "vagaId"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "candidaturaId"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "curriculoId"!: unknown;

  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiProperty({"type":"string","enum":["SISTEMA","USUARIO"]})
  "origem"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "ocorridoEm"!: unknown;

  @ApiProperty({"oneOf":[{}],"nullable":true})
  "dados"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "registradoEm"!: unknown;

}

export class RespostaObjeto81Dto {
  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto80Dto"}})
  "itens"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "proximoCursor"!: unknown;

}

export class RespostaObjeto82Dto {
  @ApiProperty({ ...{}, type: () => RespostaObjeto83Dto })
  "oportunidade"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto8Dto })
  "candidatura"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto80Dto })
  "evento"!: unknown;

}

export class RespostaObjeto83Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "usuarioId"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "criadoEm"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "fonte"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/Keyword"},"nullable":true})
  "keywords"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","VALIDAS"]})
  "keywordsStatus"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","ERRO","EXTRAINDO","PRONTAS"]})
  "keywordsExtracao"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "keywordsErro"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({"type":"string","enum":["BAIXA","MEDIA","ALTA"]})
  "prioridade"!: unknown;

  @ApiProperty({"type":"string","enum":["MANUAL","IMPORTACAO"]})
  "origem"!: unknown;

  @ApiProperty({"type":"string","enum":["ENTRADA","ATIVA"]})
  "estagio"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "origemImportacaoId"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "arquivadaEm"!: unknown;

}

export class RespostaObjeto84Dto {
  @ApiProperty({"type":"string"})
  "jobId"!: unknown;

  @ApiProperty({"type":"string","enum":["PENDENTE","ERRO","ANALISANDO","GERANDO","VALIDANDO","CONCLUIDA"]})
  "status"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "curriculoId"!: unknown;

}

export class RespostaObjeto85Dto {
  @ApiProperty({"type":"string"})
  "jobId"!: unknown;

}

export class RespostaObjeto86Dto {
  @ApiProperty({"type":"number"})
  "score"!: unknown;

  @ApiPropertyOptional({"type":"number"})
  "scoreVersao"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsEncontradas"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "keywordsCriticasAusentes"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "pontosEliminatorios"!: unknown;

  @ApiProperty({"type":"string"})
  "veredicto"!: unknown;

  @ApiProperty({ ...{}, type: () => ScoreBreakdown })
  "breakdown"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "degradacao"!: unknown;

}

export class RespostaObjeto87Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => ScoreBreakdown })
  "breakdown"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseInicial"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => AtsAnalysis })
  "analiseFinal"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "degradacao"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "geradoEm"!: unknown;

}

export class RespostaObjeto88Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "usuarioId"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "atualizadoEm"!: unknown;

  @ApiProperty({"type":"string"})
  "nome"!: unknown;

  @ApiProperty({"type":"string"})
  "resumo"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto89Dto"}})
  "experiencias"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto91Dto"}})
  "formacao"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto92Dto"}})
  "certificacoes"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "idiomas"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "skills"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto93Dto"}})
  "emails"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto94Dto"}})
  "telefones"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto95Dto"}})
  "links"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto96Dto })
  "endereco"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto97Dto"}})
  "outrosContatos"!: unknown;

}

export class RespostaObjeto89Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "cargo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "dataInicioMes"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "dataInicioAno"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "dataFimMes"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "dataFimAno"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "atual"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto90Dto })
  "local"!: unknown;

  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "periodoLegado"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "localLegado"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto90Dto {
  @ApiProperty({"type":"string"})
  "pais"!: unknown;

  @ApiProperty({"type":"string"})
  "estado"!: unknown;

  @ApiProperty({"type":"string"})
  "cidade"!: unknown;

}

export class RespostaObjeto91Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "grau"!: unknown;

  @ApiProperty({"type":"string","enum":["","concluido","em_andamento","trancado"]})
  "status"!: unknown;

  @ApiProperty({"type":"string"})
  "instituicao"!: unknown;

  @ApiProperty({"type":"string"})
  "curso"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "inicioMes"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "inicioAno"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "fimMes"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "fimAno"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto92Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "descricao"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto93Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "valor"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto94Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "ddi"!: unknown;

  @ApiProperty({"type":"string"})
  "numero"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "principal"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto95Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string","enum":["linkedin","github","facebook","instagram","site"]})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "url"!: unknown;

}

export class RespostaObjeto96Dto {
  @ApiPropertyOptional({"type":"string"})
  "bairro"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "logradouro"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "complemento"!: unknown;

  @ApiPropertyOptional({"type":"string"})
  "legado"!: unknown;

  @ApiProperty({"type":"string"})
  "pais"!: unknown;

  @ApiProperty({"type":"string"})
  "estado"!: unknown;

  @ApiProperty({"type":"string"})
  "cidade"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto97Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"string"})
  "valor"!: unknown;

  @ApiPropertyOptional({"type":"array","items":{"type":"string","enum":["formato_antigo","periodo_texto","local_texto","tecnologias_na_descricao","ddi_ausente","localizacao_texto","contato_sem_tipo","email_invalido"]}})
  "revisao"!: unknown;

}

export class RespostaObjeto98Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "titulo"!: unknown;

  @ApiProperty({"type":"string"})
  "empresa"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "categoria"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "nivel"!: unknown;

  @ApiProperty({"type":"string","enum":["BAIXA","MEDIA","ALTA"]})
  "prioridade"!: unknown;

  @ApiProperty({"type":"string","enum":["ENTRADA","ATIVA","ENCERRADA"]})
  "apresentacao"!: unknown;

  @ApiProperty({"type":"string","enum":["INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","PREPARACAO","ENCERRADAS"]})
  "etapa"!: unknown;

  @ApiProperty({"type":"string","enum":["RASCUNHO","INSCRITA","EM_PROCESSO","ENTREVISTA","OFERTA","REJEITADA","DESISTIU"]})
  "statusCandidatura"!: unknown;

  @ApiProperty({"type":"string","format":"date-time","nullable":true})
  "arquivadaEm"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto99Dto })
  "curriculo"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto1Dto })
  "proximoPasso"!: unknown;

  @ApiProperty({"type":"string","format":"date-time"})
  "ultimaAtividade"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/Keyword"},"nullable":true})
  "keywords"!: unknown;

}

export class RespostaObjeto99Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

  @ApiProperty({"type":"number","nullable":true})
  "score"!: unknown;

}

export class RespostaObjeto100Dto {
  @ApiProperty({"type":"string"})
  "schemaVersion"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto101Dto"}})
  "nodes"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto102Dto"}})
  "edges"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto103Dto })
  "facets"!: unknown;

}

export class RespostaObjeto101Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

  @ApiProperty({"type":"string"})
  "rotulo"!: unknown;

}

export class RespostaObjeto102Dto {
  @ApiProperty({"type":"string"})
  "id"!: unknown;

  @ApiProperty({"type":"string"})
  "origem"!: unknown;

  @ApiProperty({"type":"string"})
  "destino"!: unknown;

  @ApiProperty({"type":"string"})
  "tipo"!: unknown;

}

export class RespostaObjeto103Dto {
  @ApiProperty({"type":"array","items":{"type":"string"}})
  "empresas"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "categorias"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "niveis"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "skills"!: unknown;

}

export class HealthResponseDto {
  @ApiProperty({"type":"string","enum":["api"]})
  "service"!: unknown;

  @ApiProperty({"type":"string","enum":["ok"]})
  "status"!: unknown;

}

export class RespostaObjeto105Dto {
  @ApiProperty({"type":"string","enum":["api"]})
  "servico"!: unknown;

  @ApiProperty({"type":"string","enum":["pronto","indisponivel"]})
  "status"!: unknown;

  @ApiProperty({"type":"array","items":{"$ref":"#/components/schemas/RespostaObjeto106Dto"}})
  "dependencias"!: unknown;

}

export class RespostaObjeto106Dto {
  @ApiProperty({"type":"string"})
  "nome"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "obrigatoria"!: unknown;

  @ApiProperty({"type":"string","enum":["ok","indisponivel","desconhecido"]})
  "estado"!: unknown;

}

export class RespostaObjeto107Dto {
  @ApiProperty({"type":"array","items":{"type":"string"}})
  "categorias"!: unknown;

  @ApiProperty({"type":"array","items":{"type":"string"}})
  "niveis"!: unknown;

}

export class RespostaObjeto108Dto {
  @ApiProperty({"type":"string","enum":["token"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto109Dto })
  "data"!: unknown;

}

export class RespostaObjeto109Dto {
  @ApiProperty({"type":"string"})
  "delta"!: unknown;

}

export class RespostaObjeto110Dto {
  @ApiProperty({"type":"string","enum":["tool_call"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto111Dto })
  "data"!: unknown;

}

export class RespostaObjeto111Dto {
  @ApiProperty({"type":"string"})
  "callId"!: unknown;

  @ApiProperty({"type":"string"})
  "tool"!: unknown;

  @ApiProperty({"type":"string","enum":["leitura","escrita"]})
  "efeito"!: unknown;

  @ApiProperty({"type":"object","additionalProperties":{"oneOf":[{}]}})
  "args"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "exigeConfirmacao"!: unknown;

}

export class RespostaObjeto112Dto {
  @ApiProperty({"type":"string","enum":["confirmacao"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto113Dto })
  "data"!: unknown;

}

export class RespostaObjeto113Dto {
  @ApiProperty({"type":"string"})
  "callId"!: unknown;

  @ApiProperty({"type":"string"})
  "tool"!: unknown;

  @ApiProperty({"type":"string"})
  "resumo"!: unknown;

  @ApiProperty({"type":"object","additionalProperties":{"oneOf":[{}]}})
  "args"!: unknown;

}

export class RespostaObjeto114Dto {
  @ApiProperty({"type":"string","enum":["tool_resultado"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto115Dto })
  "data"!: unknown;

}

export class RespostaObjeto115Dto {
  @ApiProperty({"type":"string"})
  "callId"!: unknown;

  @ApiProperty({"type":"string"})
  "tool"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "ok"!: unknown;

  @ApiProperty({"oneOf":[{}]})
  "resultado"!: unknown;

  @ApiProperty({ ...{"nullable":true}, type: () => RespostaObjeto116Dto })
  "erro"!: unknown;

}

export class RespostaObjeto116Dto {
  @ApiProperty({"type":"string"})
  "mensagem"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "recuperavel"!: unknown;

}

export class RespostaObjeto117Dto {
  @ApiProperty({"type":"string","enum":["entrega_externa"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto31Dto })
  "data"!: unknown;

}

export class RespostaObjeto118Dto {
  @ApiProperty({"type":"string","enum":["erro"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto119Dto })
  "data"!: unknown;

}

export class RespostaObjeto119Dto {
  @ApiProperty({"type":"string"})
  "escopo"!: unknown;

  @ApiProperty({"type":"string"})
  "mensagem"!: unknown;

  @ApiProperty({"type":"boolean","enum":[false,true]})
  "recuperavel"!: unknown;

  @ApiPropertyOptional({"type":"number"})
  "retryAfter"!: unknown;

}

export class RespostaObjeto120Dto {
  @ApiProperty({"type":"string","enum":["fim_turno"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto121Dto })
  "data"!: unknown;

}

export class RespostaObjeto121Dto {
  @ApiProperty({"type":"string"})
  "motivo"!: unknown;

  @ApiProperty({"type":"string"})
  "conversaId"!: unknown;

}

export class RespostaObjeto122Dto {
  @ApiProperty({"type":"string","enum":["conversa"]})
  "evento"!: unknown;

  @ApiProperty({ ...{}, type: () => RespostaObjeto123Dto })
  "data"!: unknown;

}

export class RespostaObjeto123Dto {
  @ApiProperty({"type":"string"})
  "conversaId"!: unknown;

}

export class CorpoErro {
  @ApiProperty({ ...{}, type: () => RespostaObjeto125Dto })
  "erro"!: unknown;

}

export class RespostaObjeto125Dto {
  @ApiProperty({"type":"string"})
  "codigo"!: unknown;

  @ApiProperty({"type":"string"})
  "mensagem"!: unknown;

  @ApiProperty({"type":"string","nullable":true})
  "requestId"!: unknown;

  @ApiPropertyOptional({"type":"object","additionalProperties":{"oneOf":[{}]}})
  "detalhes"!: unknown;

}

export class RespostaExcecao {
  @ApiProperty({"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]})
  "message"!: unknown;

}

export const modelosResposta = [RespostaObjeto1Dto, RespostaObjeto2Dto, RespostaObjeto3Dto, RespostaObjeto4Dto, RespostaObjeto5Dto, RespostaObjeto6Dto, RespostaObjeto7Dto, RespostaObjeto8Dto, RespostaObjeto9Dto, RespostaObjeto10Dto, RespostaObjeto11Dto, RespostaObjeto12Dto, RespostaObjeto13Dto, RespostaObjeto14Dto, RespostaObjeto15Dto, RespostaObjeto16Dto, RespostaObjeto17Dto, RespostaObjeto18Dto, RespostaObjeto19Dto, RespostaObjeto20Dto, RespostaObjeto21Dto, RespostaObjeto22Dto, RespostaObjeto23Dto, RespostaObjeto24Dto, RespostaObjeto25Dto, RespostaObjeto26Dto, RespostaObjeto27Dto, RespostaObjeto28Dto, RespostaObjeto29Dto, RespostaObjeto30Dto, RespostaObjeto31Dto, AvisoAcao, RespostaObjeto33Dto, RespostaObjeto34Dto, RespostaObjeto35Dto, RespostaObjeto36Dto, RespostaObjeto37Dto, RespostaObjeto38Dto, RespostaObjeto39Dto, ScoreBreakdown, AtsAnalysis, RespostaObjeto42Dto, RespostaObjeto43Dto, RespostaObjeto44Dto, RespostaObjeto45Dto, RespostaObjeto46Dto, RespostaObjeto47Dto, RespostaObjeto48Dto, RespostaObjeto49Dto, RespostaObjeto50Dto, RespostaObjeto51Dto, RespostaObjeto52Dto, RespostaObjeto53Dto, RespostaObjeto54Dto, RespostaObjeto55Dto, RespostaObjeto56Dto, RespostaObjeto57Dto, RespostaObjeto58Dto, RespostaObjeto59Dto, RespostaObjeto60Dto, RespostaObjeto61Dto, RespostaObjeto62Dto, RespostaObjeto63Dto, RespostaObjeto64Dto, Keyword, RespostaObjeto66Dto, RespostaObjeto67Dto, RespostaObjeto68Dto, RespostaObjeto69Dto, RespostaObjeto70Dto, RespostaObjeto71Dto, RespostaObjeto72Dto, RespostaObjeto73Dto, RespostaObjeto74Dto, RespostaObjeto75Dto, RespostaObjeto76Dto, RespostaObjeto77Dto, RespostaObjeto78Dto, RespostaObjeto79Dto, RespostaObjeto80Dto, RespostaObjeto81Dto, RespostaObjeto82Dto, RespostaObjeto83Dto, RespostaObjeto84Dto, RespostaObjeto85Dto, RespostaObjeto86Dto, RespostaObjeto87Dto, RespostaObjeto88Dto, RespostaObjeto89Dto, RespostaObjeto90Dto, RespostaObjeto91Dto, RespostaObjeto92Dto, RespostaObjeto93Dto, RespostaObjeto94Dto, RespostaObjeto95Dto, RespostaObjeto96Dto, RespostaObjeto97Dto, RespostaObjeto98Dto, RespostaObjeto99Dto, RespostaObjeto100Dto, RespostaObjeto101Dto, RespostaObjeto102Dto, RespostaObjeto103Dto, HealthResponseDto, RespostaObjeto105Dto, RespostaObjeto106Dto, RespostaObjeto107Dto, RespostaObjeto108Dto, RespostaObjeto109Dto, RespostaObjeto110Dto, RespostaObjeto111Dto, RespostaObjeto112Dto, RespostaObjeto113Dto, RespostaObjeto114Dto, RespostaObjeto115Dto, RespostaObjeto116Dto, RespostaObjeto117Dto, RespostaObjeto118Dto, RespostaObjeto119Dto, RespostaObjeto120Dto, RespostaObjeto121Dto, RespostaObjeto122Dto, RespostaObjeto123Dto, CorpoErro, RespostaObjeto125Dto, RespostaExcecao];
export const respostasContrato = [
  {
    "controller": "AcoesController",
    "metodo": "listar",
    "schema": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/RespostaObjeto1Dto"
      }
    }
  },
  {
    "controller": "AcoesController",
    "metodo": "criar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto1Dto"
    }
  },
  {
    "controller": "AcoesController",
    "metodo": "atualizar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto1Dto"
    }
  },
  {
    "controller": "AcoesController",
    "metodo": "concluir",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto1Dto"
    }
  },
  {
    "controller": "AcoesController",
    "metodo": "cancelar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto1Dto"
    }
  },
  {
    "controller": "AuthController",
    "metodo": "register",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto2Dto"
    }
  },
  {
    "controller": "AuthController",
    "metodo": "login",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto3Dto"
    }
  },
  {
    "controller": "AuthController",
    "metodo": "refresh",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto5Dto"
    }
  },
  {
    "controller": "AuthController",
    "metodo": "sessao",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto6Dto"
    }
  },
  {
    "controller": "AuthController",
    "metodo": "logout",
    "schema": null
  },
  {
    "controller": "AuthController",
    "metodo": "trocarSenha",
    "schema": null
  },
  {
    "controller": "CandidaturasController",
    "metodo": "criar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto8Dto"
    }
  },
  {
    "controller": "CandidaturasController",
    "metodo": "listar",
    "schema": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/RespostaObjeto9Dto"
      }
    }
  },
  {
    "controller": "CandidaturasController",
    "metodo": "atualizar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto8Dto"
    }
  },
  {
    "controller": "ContaController",
    "metodo": "buscar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto12Dto"
    }
  },
  {
    "controller": "ContaController",
    "metodo": "consentir",
    "schema": null
  },
  {
    "controller": "ContaController",
    "metodo": "revogar",
    "schema": null
  },
  {
    "controller": "ContaController",
    "metodo": "exportar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto14Dto"
    }
  },
  {
    "controller": "ContaController",
    "metodo": "statusExportacao",
    "schema": {
      "oneOf": [
        {
          "$ref": "#/components/schemas/RespostaObjeto15Dto"
        },
        {
          "$ref": "#/components/schemas/RespostaObjeto16Dto"
        }
      ]
    }
  },
  {
    "controller": "ContaController",
    "metodo": "agendarExclusao",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto17Dto"
    }
  },
  {
    "controller": "ContaController",
    "metodo": "cancelarExclusao",
    "schema": null
  },
  {
    "controller": "ContextoController",
    "metodo": "reindexar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto18Dto"
    }
  },
  {
    "controller": "ContextoController",
    "metodo": "upload",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto19Dto"
    }
  },
  {
    "controller": "ContextoController",
    "metodo": "status",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto20Dto"
    }
  },
  {
    "controller": "CopilotoController",
    "metodo": "listarConversas",
    "schema": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/RespostaObjeto22Dto"
      }
    }
  },
  {
    "controller": "CopilotoController",
    "metodo": "buscarConversa",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto23Dto"
    }
  },
  {
    "controller": "CopilotoController",
    "metodo": "chatSse",
    "schema": null
  },
  {
    "controller": "CopilotoController",
    "metodo": "mensagemRecrutador",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto35Dto"
    }
  },
  {
    "controller": "CopilotoController",
    "metodo": "respostasFormulario",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto36Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "listar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto38Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "status",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto44Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "buscar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto46Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "editar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto46Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "gerarArquivos",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto46Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "docx",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto49Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "pdf",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto49Dto"
    }
  },
  {
    "controller": "CurriculosController",
    "metodo": "pacote",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto49Dto"
    }
  },
  {
    "controller": "HojeController",
    "metodo": "agenda",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto50Dto"
    }
  },
  {
    "controller": "HojeController",
    "metodo": "preferencias",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto60Dto"
    }
  },
  {
    "controller": "HojeController",
    "metodo": "atualizar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto60Dto"
    }
  },
  {
    "controller": "LotesController",
    "metodo": "status",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto61Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "listar",
    "schema": {
      "oneOf": [
        {
          "$ref": "#/components/schemas/RespostaObjeto63Dto"
        },
        {
          "$ref": "#/components/schemas/RespostaObjeto66Dto"
        },
        {
          "$ref": "#/components/schemas/RespostaObjeto70Dto"
        }
      ]
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "criar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto71Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "importar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto72Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "ativar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto71Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "workspace",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto73Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "timeline",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto81Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "nota",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto80Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "candidaturaPrincipal",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto8Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "transicionar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto82Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "gerarCv",
    "schema": {
      "oneOf": [
        {
          "$ref": "#/components/schemas/RespostaObjeto84Dto"
        },
        {
          "$ref": "#/components/schemas/RespostaObjeto85Dto"
        }
      ]
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "analisarAts",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto86Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "curriculosDaOportunidade",
    "schema": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/RespostaObjeto87Dto"
      }
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "buscar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto74Dto"
    }
  },
  {
    "controller": "OportunidadesController",
    "metodo": "atualizar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto71Dto"
    }
  },
  {
    "controller": "PerfilController",
    "metodo": "buscar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto88Dto",
      "nullable": true
    }
  },
  {
    "controller": "PerfilController",
    "metodo": "salvar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto88Dto"
    }
  },
  {
    "controller": "PipelineController",
    "metodo": "listar",
    "schema": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/RespostaObjeto98Dto"
      }
    }
  },
  {
    "controller": "PipelineController",
    "metodo": "grafo",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto100Dto"
    }
  },
  {
    "controller": "SaudeController",
    "metodo": "health",
    "schema": {
      "$ref": "#/components/schemas/HealthResponseDto"
    }
  },
  {
    "controller": "SaudeController",
    "metodo": "ready",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto105Dto"
    }
  },
  {
    "controller": "TaxonomiaController",
    "metodo": "listar",
    "schema": {
      "$ref": "#/components/schemas/RespostaObjeto107Dto"
    }
  }
];
export const eventosCopiloto = {"oneOf":[{"$ref":"#/components/schemas/RespostaObjeto108Dto"},{"$ref":"#/components/schemas/RespostaObjeto110Dto"},{"$ref":"#/components/schemas/RespostaObjeto112Dto"},{"$ref":"#/components/schemas/RespostaObjeto114Dto"},{"$ref":"#/components/schemas/RespostaObjeto117Dto"},{"$ref":"#/components/schemas/RespostaObjeto118Dto"},{"$ref":"#/components/schemas/RespostaObjeto120Dto"},{"$ref":"#/components/schemas/RespostaObjeto122Dto"}]};
