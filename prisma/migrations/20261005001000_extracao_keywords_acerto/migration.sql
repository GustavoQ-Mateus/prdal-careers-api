UPDATE "vagas" v SET "keywords_extracao" = 'PRONTAS', "keywords_erro" = NULL
 WHERE v."keywords_status" = 'VALIDAS'
   AND v."keywords_extracao" = 'PENDENTE'
   AND NOT EXISTS (SELECT 1 FROM "jobs" j WHERE j."tipo" = 'extrair_keywords' AND j."referencia_id" = v."id");

UPDATE "vagas" v SET "keywords_extracao" = 'ERRO', "keywords_erro" = 'A extração de keywords desta oportunidade não terminou. Use reprocessar keywords para tentar de novo.'
 WHERE v."keywords_status" = 'PENDENTE'
   AND v."keywords_extracao" = 'PENDENTE'
   AND NOT EXISTS (SELECT 1 FROM "jobs" j WHERE j."tipo" = 'extrair_keywords' AND j."referencia_id" = v."id");
