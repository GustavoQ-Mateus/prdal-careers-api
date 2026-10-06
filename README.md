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

## Telemetria do início do copiloto

`POST /v1/telemetria/eventos` exige sessão autenticada e proteção CSRF. Recebe `evento`, `sessaoId` e `acao`, e responde 204 sem corpo. Os eventos aceitos são `copiloto_primeira_mensagem` e `copiloto_acao_rapida`; o segundo exige `acao`. `sessaoId` é opaco, tem de 1 a 64 caracteres e aceita somente letras ASCII, números, `_` e `-`. Não envie nomes, mensagens nem outros dados pessoais nesse identificador.

As ações aceitas correspondem aos botões atuais do início: `preparar_envio`, `redigir_mensagem`, `redigir_resposta`, `preparar_entrevista`, `preparar_curriculo`, `definir_proximo_passo`, `abrir_oportunidade`, `analisar_vaga`, `montar_perfil`, `retomar_conversa`, `ver_agenda` e `abrir_curriculo`. Nenhum campo de texto livre é registrado.

Cada evento validado gera uma linha JSON no logger da API, com `requestId` do contexto da requisição:

```json
{"horario":"2026-10-05T12:00:00.000Z","nivel":"log","servico":"api","contexto":"TelemetriaController","requestId":"req-exemplo","mensagem":"evento de telemetria","telemetria":true,"usuarioId":"usuario-exemplo","evento":"copiloto_acao_rapida","sessaoId":"aba-exemplo","acao":"preparar_envio"}
```

Quando não há ação, `acao` é `null`. A API não persiste esses eventos nem deduplica sessões. O cliente deve emitir a primeira mensagem uma vez por sessão. A infraestrutura cria posteriormente o filtro de métrica do CloudWatch com `{ $.telemetria = true }`, valor 1 por linha, e pode filtrar por `evento` e `acao`. A API não possui módulo de métricas nem publica métricas diretamente.

## Imagem

```text
docker build -t prdal-api .
```

O contexto é somente esta pasta. A imagem final executa sem root e não inclui dependências de desenvolvimento nem configurações de agentes. Injete as variáveis com --env-file em um arquivo local fora do controle de versão.

## Variáveis de ambiente

Use `.env.example` como referência, sem versionar segredos. As variáveis opcionais usam os padrões definidos no código; configure explicitamente os destinos de banco e serviços no seu ambiente.

`AI_LLM_TIMEOUT_MS`, `AI_SERVICE_URL`, `API_BODY_LIMIT`, `API_PREFIXO`, `API_SELF_URL`, `AWS_ACCESS_KEY_ID`, `AWS_REGION`, `AWS_SECRET_ACCESS_KEY`, `CORS_ORIGINS`, `COTA_TOKENS_DIA`, `DATABASE_URL`, `DOC_SERVICE_URL`, `EMBED_DIMENSAO`, `EXCLUSAO_PRAZO_DIAS`, `JWT_SECRET`, `LLM_PROVEDOR`, `LLM_REGIAO`, `LOG_NIVEL`, `NODE_ENV`, `PORT`, `PRDAL_HSTS`, `PRDAL_HTTPS`, `PRONTIDAO_TIMEOUT_MS`, `REFRESH_TOLERANCIA_S`, `REFRESH_TTL_DIAS`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ENDPOINT_PUBLICO`, `S3_URL_VALIDADE_S`, `SERVICE_TOKEN`, `SQS_ENDPOINT`, `SQS_FILA_JOBS_URL`, `TRUST_PROXY`.
