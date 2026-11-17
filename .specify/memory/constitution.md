# Consumo Meta Constitution

## Core Principles

### I. Hexagonal com domínio puro
`backend/server/domain/` não importa Fastify, Prisma, axios nem nada de `adapters/`, e fala com o mundo só pelas portas em `domain/ports/`. As rotas são finas, sem regra de negócio. A resposta crua de APIs externas (Meta, Helena) é convertida para tipos nossos dentro do gateway, e o domínio nunca vê o JSON externo.

### II. Schema só por Prisma Migrate
Toda mudança de banco é uma migration do Prisma, aplicada com `prisma migrate deploy` no boot. `$queryRaw` só é permitido para agregações que o query builder não expressa. Categorias e status são `enum` do Prisma. Banco em `snake_case`, TypeScript em `camelCase`, negócio em português.

### III. Regra de negócio com teste (NÃO NEGOCIÁVEL)
Toda regra de negócio, todo mapeamento de API externa e toda rota nova nasce com teste Vitest, sem banco nem HTTP reais (portas mockadas). Fixtures de API externa usam a forma real documentada. `npm run lint && npm test` precisam estar verdes antes de qualquer merge.

### IV. Fronteira do monorepo
`frontend/` e `backend/` são workspaces independentes, cada um com `package.json` e `.env` próprios. Nenhum importa código do outro: a única ponte é a API HTTP em `/api`.

### V. Segredos e isolamento por `companyid`
- Tokens de terceiros ficam cifrados em repouso (AES-256-GCM, `node:crypto`) e nunca voltam ao frontend.
- Nada de token, payload cru ou conteúdo e telefone de mensagem em log. URLs são logadas sem query string.
- Toda tabela de negócio tem `companyid`, toda query filtra por ele e toda rota nova tem teste de isolamento entre empresas.

### VI. Simplicidade operacional
Sem Redis, fila ou ferramenta paralela à stack definida no plano. Dependência nova só com justificativa no Complexity Tracking do plano. Nada de interface com uma implementação só (exceto as portas do domínio), nem config para valor fixo.

### VII. Atalhos conscientes
Todo atalho com limite conhecido leva um comentário `ponytail:` dizendo o limite e o caminho de upgrade. Os comentários explicam o porquê, não o quê.

## Restrições de Stack
TypeScript, Node 22, ESM (imports relativos com `.js`). Backend com Fastify 5, Prisma 7 (`@prisma/adapter-pg`), zod 4, pino 10 (logger único, sem `console.*`), axios, date-fns, node-cron e OpenTelemetry. Frontend com React 19, Vite 6, Tailwind 4, shadcn/ui e estado só com hooks locais. Banco PostgreSQL 16. Deploy em 1 container no Coolify.

## Fluxo de Desenvolvimento
- Branches `feat/...` e `fix/...` a partir de `main`, com uma PR por etapa do plano.
- Commits e PRs em português, no formato `Área: o que mudou`.
- REST: sucesso devolve o objeto direto; erro devolve `{ error, codigo? }` com o status correto, e em 5xx inclui `traceId`.

## Governance
Esta constituição prevalece sobre preferências individuais. Toda PR verifica a conformidade com ela, e qualquer violação precisa estar justificada no Complexity Tracking do plano. Emendas exigem PR própria com versão incrementada (SemVer: MAJOR remove ou redefine princípio, MINOR adiciona, PATCH esclarece).

**Version**: 1.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-17
