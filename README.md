# api

API NestJS com autenticação, pipeline de oportunidades e persistência PostgreSQL. Implementa a `spec-v1.11.0`.

## Instalação, testes e execução

Execute na raiz desta unidade. Não são necessários arquivos do monorepo. Requer Node.js 22 e Git para instalar os contratos quando aplicável.

```text
npm ci
npm test
npm run build
npm run migracao:aplicar
npm run start:prod
```

Defina DATABASE_URL para um PostgreSQL com pgvector, JWT_SECRET e SERVICE_TOKEN com pelo menos 32 bytes aleatórios. As migrações desta pasta pertencem à API. Para executar também os testes PostgreSQL, defina PRDAL_TESTE_POSTGRES_URL para um banco descartável e rode node --test --test-concurrency=1 "test/*.test.js" após o build. /health indica execução e /ready verifica as dependências; somente PostgreSQL é obrigatório.

## Imagem

```text
docker build -t prdal-api .
```

O contexto é somente esta pasta. A imagem final executa sem root e não inclui dependências de desenvolvimento nem configurações de agentes. Injete as variáveis com --env-file em um arquivo local fora do controle de versão.

## Variáveis de ambiente

Use `.env.example` como referência, sem versionar segredos. As variáveis opcionais usam os padrões definidos no código; configure explicitamente os destinos de banco e serviços no seu ambiente.

`AI_LLM_TIMEOUT_MS`, `AI_SERVICE_URL`, `API_BODY_LIMIT`, `API_PREFIXO`, `API_SELF_URL`, `AWS_ACCESS_KEY_ID`, `AWS_REGION`, `AWS_SECRET_ACCESS_KEY`, `CORS_ORIGINS`, `COTA_TOKENS_DIA`, `DATABASE_URL`, `DOC_SERVICE_URL`, `EMBED_DIMENSAO`, `EXCLUSAO_PRAZO_DIAS`, `JWT_SECRET`, `LLM_PROVEDOR`, `LLM_REGIAO`, `LOG_NIVEL`, `NODE_ENV`, `PORT`, `PRDAL_HSTS`, `PRDAL_HTTPS`, `PRONTIDAO_TIMEOUT_MS`, `REFRESH_TOLERANCIA_S`, `REFRESH_TTL_DIAS`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ENDPOINT_PUBLICO`, `S3_URL_VALIDADE_S`, `SERVICE_TOKEN`, `SQS_ENDPOINT`, `SQS_FILA_JOBS_URL`, `TRUST_PROXY`.
