# Implementation Plan: Consumo Meta: Dashboard de Consumo da WhatsApp Cloud API

**Branch**: `001-consumo-meta` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-consumo-meta/spec.md`

## Summary

Plataforma multi-tenant embutida no Chatfast:
- **Coleta:** um `node-cron` no próprio processo coleta, de hora em hora, `pricing_analytics` (volume e custo por número, categoria, tipo de preço e país) e `analytics` (enviadas e entregues) da Graph API v27.0 de cada WABA, e grava fatos diários idempotentes no Postgres.
- **Dashboard do cliente:** lê só o banco. Converte o custo para R$ por uma cotação global com vigência e mostra os cards, gráficos e tabela do mockup, com exportação Excel e impressão em PDF.
- **Admin:** quem é admin na Helena da conta da Fasterisk gerencia clientes, WABAs, tokens (AES-256-GCM), cotação e sincronizações.
- **Identidade:** é provada pela Helena (agente do `company_id`) e mantida numa sessão HMAC de 12 h.

## Technical Context

**Language/Version**: TypeScript ~5.8, Node 22, ESM

**Primary Dependencies**:
- Back: Fastify 5, Prisma 7 + `@prisma/adapter-pg`, zod 4, pino 10, axios, date-fns, node-cron, OpenTelemetry.
- Front: React 19, Vite 6, Tailwind 4, shadcn/ui (+ chart/`recharts`), lucide-react, sonner.
- Nova dependência: `exceljs` (ver Complexity Tracking).

**Storage**: PostgreSQL 16 (Prisma Migrate, `migrate deploy` no boot)

**Testing**: Vitest 5 + jsdom + Testing Library. Meta, Helena e Prisma mockados por portas, sem banco ou HTTP reais.

**Target Platform**: 1 container Linux (`node:22-alpine`) no Coolify, servindo `/api` e o front na mesma origem, embutido em iframe em `app.chatfast.chat` e `web.helena.run`.

**Project Type**: web-service + SPA (monorepo npm workspaces `backend/` e `frontend/`)

**Performance Goals**:
- `GET /resumo` ≤ 2 s com 90 dias e 20 números (SC-04).
- Excel ≤ 10 s (SC-12).
- Tick de sync cabe no intervalo para dezenas de contas.

**Constraints**:
- O dashboard nunca chama a Meta.
- Limite da Meta de 200 chamadas/h por WABA.
- Histórico da Meta de 1 ano.
- Custo ausente ≠ 0.
- Tokens nunca saem do backend nem vão para logs.
- Layout para largura de iframe.

**Scale/Scope**: dezenas de clientes, 1 a 3 WABAs cada, 1 a 20 números por WABA, 2 telas (dashboard e admin).

Não há itens NEEDS CLARIFICATION: todos foram resolvidos no [research.md](research.md). Os pontos ⚠️ restantes têm validação marcada por etapa.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ainda é o template, sem princípios ratificados. Ele será redigido na **etapa 1**. Até lá, os gates abaixo vêm das regras do brief original, que viram a constituição:

| Gate | Pré-design | Pós-design |
|---|---|---|
| Hexagonal: `domain/` puro, sem Fastify, Prisma ou axios; mundo externo só via `ports/` | ✅ | ✅ Portas: `MetaGateway`, `HelenaGateway`, `ConsumoRepository`, `ContaRepository`, `Cifra`. O JSON da Meta é normalizado no gateway |
| Rotas finas, sem regra de negócio | ✅ | ✅ Regras em `services/` e `domain/` |
| Schema só por Prisma Migrate; `$queryRaw` só em agregação | ✅ | ✅ 2 agregações (data-model.md) |
| Fronteira do monorepo: front e back só pela API HTTP | ✅ | ✅ contracts/api.md |
| Isolamento por `companyid` em toda tabela e query, com teste de isolamento por rota | ✅ | ✅ `cotacao` é global por ser configuração da Fasterisk (justificado) |
| Segredos cifrados (AES-256-GCM); token nunca no front nem em log; URL logada sem query | ✅ | ✅ |
| Regra de negócio com teste | ✅ | ✅ Mapa em quickstart.md §2 |
| Sem Redis ou fila; sem dependência paralela; sem abstração especulativa | ✅ | ⚠️ `exceljs` (justificado abaixo) |

**Resultado:** PASS, com 1 justificativa.

## Project Structure

### Documentation (this feature)

```text
specs/001-consumo-meta/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Fase 0: matriz de viabilidade + decisões R-01..R-12
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1: roteiro de validação
├── contracts/api.md     # Fase 1: contrato HTTP
└── tasks.md             # /speckit-tasks (ainda não criado)
```

### Source Code (repository root)

```text
/
├── package.json  tsconfig.tests.json  vitest.config.ts  vitest.setup.ts  prisma.config.ts
├── Dockerfile  docker-compose.yml  CLAUDE.md  README.md
├── backend/
│   ├── prisma/{schema.prisma, migrations/}
│   ├── server/
│   │   ├── index.ts  instrumentation.ts  logger.ts  config/env.ts
│   │   ├── domain/
│   │   │   ├── consumo/   # periodo.ts (presets no fuso), categorias.ts (7→4, cobrada/gratuita),
│   │   │   │              # cotacao.ts (cotação do dia), agregacao.ts (cards, séries, por número, situação do custo)
│   │   │   ├── sync/      # janela.ts (backfill/reprocesso/reativação), erros.ts (190/4/80007/80008 → status), status.ts
│   │   │   └── ports/     # MetaGateway, HelenaGateway, ConsumoRepository, ContaRepository, Cifra
│   │   ├── services/      # sessao, sync (lock, tick, cron), dashboard (resumo/status/sincronizar),
│   │   │                  # exportacao (xlsx), contas, clientes, cotacoes, auditoria
│   │   └── adapters/
│   │       ├── http/{app.ts, embed.ts, sessao.ts, routes/{dashboard,admin}.routes.ts}
│   │       ├── persistence/prisma/
│   │       ├── meta/metaGraphGateway.ts
│   │       ├── helena/helenaGateway.ts
│   │       └── cripto/aesGcm.ts
│   └── tests/{domain, services, adapters, fixtures/meta/}
└── frontend/
    ├── vite.config.ts
    └── src/
        ├── main.tsx  lib/api.ts  lib/telaPersistida.ts
        ├── components/ui/  shared/
        └── features/
            ├── dashboard/  # Filtros, CardsEnvio, CardsCategoria, GraficoCategorias, GraficoMensagens,
            │               # TabelaNumeros, FaixaDesatualizado, BotaoSincronizar, print.css
            └── admin/      # ListaClientes, DetalheCliente, ContaWaba, Cotacoes, FormCliente, FormConta
```

**Structure Decision:** monorepo de 2 workspaces, conforme o brief. Diferenças em relação ao brief:
- `HelenaGateway` vira porta, porque a sessão e o admin dependem dela e os testes precisam mockar.
- O webhook da Meta não existe na v1.
- O PDF não tem rota: é `print.css`.

## Sync: fluxo de um tick

1. O cron (`SYNC_CRON`, padrão `0 * * * *`) dispara. O tick carrega as contas coletáveis (data-model, "Transições de status").
2. Para cada conta, em sequência (`ponytail:` sequencial; paralelizar com limite só se o tick passar de ~50% do intervalo):
   1. adquire o lock (UPDATE condicional) ou grava a execução `IGNORADA`;
   2. calcula a janela: `historico_desde` null → backfill de `SYNC_DIAS_BACKFILL` (≤ 365); senão, os últimos `SYNC_DIAS_REPROCESSO` dias; e, ao reativar, desde `inativo_desde`;
   3. atualiza os números (`/phone_numbers`);
   4. busca o `pricing_analytics` e grava o upsert em `consumo_diario`; marca `sem_custo_meta` se não houver custo;
   5. busca o `analytics` de cada número com `coleta_ativa` e grava o upsert em `mensagens_diarias`;
   6. em caso de sucesso, grava `ultimo_sync_em`, status `ATIVA` (exceto `TOKEN_EXPIRANDO`) e zera o erro; em caso de erro, mapeia o status (R-09) e grava `ultimo_erro`;
   7. grava a `execucao_sync`, libera o lock e fecha o span `sync conta`.
3. Ao final, envia o pulso para `HEARTBEAT_URL` (`/fail` só se o tick inteiro quebrar).
4. Um job diário (`0 6 * * *`) roda o `debug_token` de cada conta e marca `TOKEN_EXPIRANDO` quando faltam 7 dias ou menos.
5. "Sincronizar agora" (admin ou cliente) chama o mesmo `sincronizarConta()` sem aguardar o fim (`202`).

## Etapas de implementação (uma PR por etapa)

| # | Entrega | Stories |
|---|---|---|
| 1 | Esqueleto do monorepo, constituição, `CLAUDE.md`, env zod, logger, `/health`, Docker | — |
| 2 | Embed, sessão + Helena (inclui o levantamento de `profile`, R-07), admin, `aesGcm` e testes de isolamento | US-01, US-02 |
| 3 | Admin: clientes, contas (`debug_token`, `phone_numbers`), números, cotação, auditoria, desativar | US-03, US-04, US-12, US-13, US-16 |
| 4 | Gateway Meta + sync (lock, janela, upsert, status, execuções, cron, heartbeat), com fixture real | US-05 |
| 5 | Dashboard: resumo, status, filtros, gráficos, tabela, faixa, sincronizar, Excel e PDF (print) | US-06 a US-11, US-14, US-15 |

## Env (`backend/.env.example`)

| Grupo | Variáveis |
|---|---|
| Servidor e banco | `PORT=3002`, `NODE_ENV`, `DATABASE_URL`, `DB_*` |
| Helena e embed | `HELENA_API_URL`, `EXIGIR_EMBED`, `EXIGIR_SESSAO`, `ORIGENS_EMBED` |
| Sessão e cifra | `SEGREDO_SESSAO`, `ADMIN_COMPANYIDS`, `CHAVE_CRIPTOGRAFIA` |
| Meta e sync | `META_GRAPH_VERSION=v27.0`, `SYNC_CRON`, `SYNC_DIAS_REPROCESSO=3`, `SYNC_DIAS_BACKFILL=90` |
| Observabilidade | `HEARTBEAT_URL`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT` |

Saíram do brief `META_APP_SECRET` e `META_WEBHOOK_VERIFY_TOKEN`, porque não há webhook na v1.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Dependência nova `exceljs` (backend) | FR-049 exige `.xlsx` com 3 abas | CSV não é Excel com abas; escrever o XML do OOXML à mão é mais código e mais risco que uma dependência madura |
| Tabela `cotacao` sem `companyid` | A cotação é global da Fasterisk (decisão da spec) | Por cliente foi rejeitada pelo usuário; o acesso é só por rota admin |
| Porta `HelenaGateway` (além das do brief) | Sessão e cadastro dependem da Helena e precisam de mock nos testes | Chamar axios direto no service quebraria o domínio puro e os testes sem HTTP |

## Pontos que contradizem o brief original (research)

1. A Meta tem **7 categorias** (incluindo `MARKETING_LITE`, `AUTHENTICATION_INTERNATIONAL` e `REFERRAL_CONVERSION`), agrupadas em 4 na tela (R-02).
2. O **custo vem na moeda da WABA**, não necessariamente em USD (R-03).
3. O `conversation_analytics` está **indisponível desde 2026-11-01**.
4. O histórico vai só até **1 ano** (R-06).
5. Não há custo em WABAs na **linha de crédito de parceiro** (R-12), o que é um risco alto se o Chatfast for o BSP pagador.
6. A Helena **não tem `isAdmin`**: usa `isOwner`/`profile`, a confirmar (R-07).
7. O PDF é feito por impressão, não por uma lib (R-10).
