UPDATE "candidaturas" SET "principal" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("vaga_id") "id"
  FROM "candidaturas"
  WHERE "vaga_id" NOT IN (SELECT "vaga_id" FROM "candidaturas" WHERE "principal" = true)
  ORDER BY "vaga_id", "atualizado_em" DESC
);
