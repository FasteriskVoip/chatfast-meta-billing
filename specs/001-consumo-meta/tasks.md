---
description: "Task list for Consumo Meta: Dashboard de Consumo da WhatsApp Cloud API"
---

# Tasks: Consumo Meta: Dashboard de Consumo da WhatsApp Cloud API

**Input**: `specs/001-consumo-meta/` (plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md)

**Tests**: SOLICITADOS. O brief original (§11) torna testes Vitest obrigatórios: sem banco ou HTTP reais, com Meta, Helena e Prisma mockados pelas portas. Os testes de cada story vêm **antes** da implementação e devem falhar primeiro.

**Organization**: por user story da spec (US-01 → `[US1]` … US-16 → `[US16]`), em ordem de prioridade P1 → P9. A US-17 (recebidas) está fora da v1 e não tem tasks.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivo diferente, sem dependência pendente).
- Caminhos relativos à raiz do repo. Imports relativos ESM com sufixo `.js`.
- **Toda task** termina com `npm run lint && npm test` verdes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: monorepo, ferramentas e infraestrutura de execução (plan.md "Project Structure"; etapa 1 do plano).

- [X] T001 Criar o `package.json` raiz com `"type":"module"`, `workspaces:["backend","frontend"]` e devDependencies `typescript ~5.8`, `vitest ^5`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` e `concurrently`. Scripts: `dev` (`tsx watch --import ./backend/server/instrumentation.ts backend/server/index.ts`), `dev:client`, `dev:full` (concurrently), `build:client`, `start` (`tsx --import ./backend/server/instrumentation.ts backend/server/index.ts`), `lint` (tsc `--noEmit` do back, do front e de `tsconfig.tests.json`) e `test` (`vitest run`). Arquivo: `package.json`
- [X] T002 [P] Criar `backend/package.json` com fastify ^5, @fastify/cors, @fastify/static, prisma e @prisma/client ^7, @prisma/adapter-pg, zod ^4, dotenv, pino ^10, axios, date-fns, node-cron, @opentelemetry/api, @opentelemetry/auto-instrumentations-node, exceljs e tsx, mais `backend/tsconfig.json` (ESM, strict, `moduleResolution: NodeNext`). Arquivos: `backend/package.json`, `backend/tsconfig.json`
- [X] T003 [P] Criar o frontend Vite 6 + React 19 + Tailwind 4 (`@tailwindcss/vite`), alias `@`→`src`, proxy `/api` → `process.env.VITE_BACKEND_URL || 'http://localhost:3002'` e `build.outDir: '../dist/client'`. Dependências: lucide-react, sonner, cmdk, axios, date-fns e @fontsource-variable/nunito. Arquivos: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/index.css`
- [X] T004 [P] Inicializar o shadcn/ui no frontend (Radix, componentes em `frontend/src/components/ui/`) e adicionar button, card, input, select, table, badge, tooltip, dialog, switch, tabs, skeleton, alert, sonner e **chart** (recharts). Arquivo: `frontend/components.json`
- [X] T005 [P] Configurar o Vitest com projetos `backend` (env node) e `frontend` (env jsdom, setup `vitest.setup.ts` importando `@testing-library/jest-dom/vitest`), mais o `tsconfig.tests.json` cobrindo `backend/tests/**` e `frontend/src/**/*.spec.tsx`. Arquivos: `vitest.config.ts`, `vitest.setup.ts`, `tsconfig.tests.json`
- [X] T006 [P] Criar `prisma.config.ts` na raiz apontando para `backend/prisma/schema.prisma`, com generator `prisma-client` e output `backend/server/generated/prisma`, mais o datasource `postgresql`. Arquivo: `prisma.config.ts`
- [X] T007 [P] Criar o `Dockerfile` multi-stage `node:22-alpine`:
  - build: `NODE_ENV=development`; copia os `package.json` dos workspaces antes do `npm ci`; roda `npx prisma generate` e `npm run build:client`;
  - runtime: `NODE_ENV=production`, `TZ=America/Fortaleza`, `HEALTHCHECK` com `wget -qO- localhost:$PORT/health` e `CMD npx prisma migrate deploy && npm start`.

  Arquivo: `Dockerfile`
- [X] T008 [P] Criar o `docker-compose.yml` só de dev: `db` (postgres:16-alpine com healthcheck `pg_isready`), `backend` (`npm run dev`, depende de db healthy) e `frontend` (`npm run dev:client`), com volumes de hot reload. Arquivo: `docker-compose.yml`
- [X] T009 [P] Criar `backend/.env.example` com todas as variáveis do plan.md "Env" e comentários de uma linha. Formato de `CHAVE_CRIPTOGRAFIA`: "32 bytes em base64". `META_GRAPH_VERSION=v27.0`, `SYNC_DIAS_REPROCESSO=3`, `SYNC_DIAS_BACKFILL=90`, `SYNC_CRON=0 * * * *`. Arquivo: `backend/.env.example`
- [X] T010 [P] Redigir a constituição com 7 princípios:
  1. hexagonal com domínio puro;
  2. Prisma Migrate como única via de schema;
  3. regra de negócio com teste;
  4. fronteira do monorepo só por HTTP;
  5. segredos cifrados e isolamento por `companyid` com teste por rota;
  6. sem Redis, fila ou dependência paralela;
  7. atalhos marcados `ponytail:`.

  Incluir governança e versão 1.0.0, ratificada em 2026-11-17. Arquivo: `.specify/memory/constitution.md`
- [X] T011 [P] Criar o `CLAUDE.md` curto (comandos, mapa de pastas, regras-chave da constituição, link para `specs/001-consumo-meta/`) e o `README.md` (como rodar em dev e em produção). Arquivos: `CLAUDE.md`, `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: env, logger, schema completo, portas, cripto, app HTTP e infraestrutura do front. Nenhuma story começa antes disto.

- [X] T012 Implementar `config/env.ts` com zod, falhando no boot com a lista das variáveis faltantes:
  - `SEGREDO_SESSAO`: mínimo de 32 caracteres; se ausente, gera um aleatório e emite `logger.warn`.
  - `CHAVE_CRIPTOGRAFIA`: base64 decodificando para exatamente 32 bytes.
  - `ADMIN_COMPANYIDS`: CSV de UUIDs.
  - `ORIGENS_EMBED`: padrão `https://app.chatfast.chat https://web.helena.run`.
  - `EXIGIR_EMBED` e `EXIGIR_SESSAO`: padrão `NODE_ENV==='production'`.
  - `SYNC_DIAS_BACKFILL`: limitado a 365.

  Arquivo: `backend/server/config/env.ts`
- [X] T013 [P] Implementar o logger pino único e `serializarErro(err)`. Para erros axios, manter só `method`, `url` **sem query string**, `status` e `code`, e remover headers e body. Arquivo: `backend/server/logger.ts`
- [X] T014 [P] Implementar o OTel. Ativo só com `OTEL_EXPORTER_OTLP_ENDPOINT`; auto-instrumentations sem `dns` e `net`; span HTTP nomeado pela rota (`requestHook` usando `routeOptions.url`). Arquivo: `backend/server/instrumentation.ts`
- [X] T015 Escrever o `schema.prisma` completo conforme o data-model.md:
  - Enums: `StatusCliente`, `StatusConta`, `CategoriaMeta` (com `OUTRA`), `TipoPreco` (com `OUTRO`), `QualidadeNumero`, `OrigemSync`, `StatusExecucao`.
  - Modelos: `Cliente`, `ContaWaba`, `Numero`, `ConsumoDiario`, `MensagensDiarias`, `Cotacao`, `ExecucaoSync`, `Auditoria`, com `@@map`/`@map` em snake_case.
  - Restrições:
    - `cliente.companyid` uuid **unique**;
    - `conta_waba.waba_id` **unique**;
    - `numero.phone_number_id` **unique**;
    - `consumo_diario.custo` `Decimal @db.Decimal(14,6)` **nullable**;
    - `consumo_diario.pais` e `tier` NOT NULL com default `''`;
    - unique `(numero_id, data, categoria, tipo_preco, pais, tier)`;
    - `mensagens_diarias` unique `(numero_id, data)`;
    - `cotacao.valor` `Decimal @db.Decimal(10,4)`;
    - `cotacao.vigente_desde` date **unique**;
    - índices `(companyid, data)` nas tabelas de fato, `(conta_waba_id, inicio desc)` em execucao_sync e `(companyid, criado_em desc)` em auditoria.

  Gerar a migration inicial. Arquivos: `backend/prisma/schema.prisma`, `backend/prisma/migrations/*_inicial/`
- [X] T016 [P] Implementar o cliente Prisma singleton com `@prisma/adapter-pg` e `DATABASE_URL`. Arquivo: `backend/server/adapters/persistence/prisma/client.ts`
- [X] T017 [P] Definir as portas do domínio como tipos puros:
  - `MetaGateway`: `validarToken`, `obterWaba`, `listarNumeros`, `pricingAnalytics`, `analytics`, com tipos nossos `PontoPreco` e `PontoEnvio`;
  - `HelenaGateway`: `obterAgente`, `listarAgentes`;
  - `ConsumoRepository`, `ContaRepository`;
  - `Cifra`: `cifrar`/`decifrar`;
  - os erros tipados `ErroToken`, `ErroLimite` e `ErroIndisponivel`.

  Arquivos: `backend/server/domain/ports/*.ts`
- [X] T018 [P] Escrever o teste do AES-GCM: ida e volta; cifra adulterada lança erro; chave errada lança erro; dois cifrados do mesmo texto diferem (IV aleatório). Arquivo: `backend/tests/adapters/aesGcm.spec.ts`
- [X] T019 Implementar `Cifra` com `node:crypto` AES-256-GCM: IV aleatório de 12 bytes por registro, tag gravada junto, formato `base64(iv).base64(tag).base64(cifra)`, e `ultimos4(texto)`. Arquivo: `backend/server/adapters/cripto/aesGcm.ts`
- [X] T020 [P] Implementar o helper de auditoria `registrarAuditoria({companyid, userId, acao, entidade, entidadeId, dados})`, que remove chaves `token*` e as substitui por `{ultimos4}`. Arquivo: `backend/server/services/auditoria.service.ts`
- [X] T021 Implementar `criarApp()` no Fastify:
  - registra cors e `@fastify/static` (`dist/client`, fallback SPA para `/dashboard` e `/admin`);
  - `GET /health` com `SELECT 1` e `{ok:true}`;
  - error handler padrão `{error, codigo?}`; em 5xx inclui `traceId` do span ativo; ZodError vira 400 `VALIDACAO`.

  Arquivo: `backend/server/adapters/http/app.ts`
- [X] T022 Implementar o boot: `criarApp().listen({port, host:'0.0.0.0'})`. O agendamento do cron entra em T076. Arquivo: `backend/server/index.ts`
- [X] T023 [P] Implementar o roteamento do front por `location.pathname` com `lazy()`: `/dashboard` → `features/dashboard`, `/admin` → `features/admin`, outros → 404 simples. `<Toaster position="top-right"/>` e fonte Nunito. Arquivos: `frontend/src/main.tsx`, `frontend/src/App.tsx`
- [X] T024 [P] Implementar `telaPersistida(chave, inicial)`, um hook `useState` sincronizado com `sessionStorage` na chave `consumo-meta:tela:${pathname}${search}`, protegido por try/catch. Arquivo: `frontend/src/lib/telaPersistida.ts`
- [X] T025 [P] Criar o formatador compartilhado. Funções: `formatarBRL(string|null)`, que devolve "—" para null e **nunca** "R$ 0,00" para null, `formatarNumero` e `formatarPercentual`. Arquivo: `frontend/src/components/shared/formatos.ts`

**Checkpoint**: `npm run dev:full` sobe, `/health` responde `{ok:true}`, as migrations aplicam e o teste do aesGcm passa.

---

## Phase 3: User Story 1 - Acesso ao dashboard pelo Chatfast com isolamento por empresa (P1) 🎯 MVP

**Goal**: abrir `/dashboard?company_id=&user_id=` dentro do Chatfast, validar o agente na Helena, emitir a sessão e isolar todos os dados por `companyid`.

**Independent Test**: abrir a URL com um cliente cadastrado e um agente válido e ver a tela vazia da empresa. Com outra empresa ou agente inválido, ver a mensagem correspondente. Os testes de isolamento passam.

### Tests for User Story 1 ⚠️ (devem falhar primeiro)
- [X] T026 [P] [US1] Testar o embed:
  - HTML com `Content-Security-Policy: frame-ancestors <ORIGENS_EMBED>`;
  - GET de tela com `Sec-Fetch-Dest: document` → 403 genérico quando `EXIGIR_EMBED=true`;
  - `/api/*` e `/health` nunca bloqueados;
  - `EXIGIR_EMBED=false` não bloqueia.

  Arquivo: `backend/tests/adapters/embed.spec.ts`
- [X] T027 [P] [US1] Testar o token de sessão:
  - emitir e verificar `{cid, uid, nome, admin, exp}`;
  - assinatura adulterada → inválido;
  - `exp` vencido → inválido;
  - payload adulterado com a mesma assinatura → inválido (`timingSafeEqual`).

  Arquivo: `backend/tests/adapters/sessao.spec.ts`
- [X] T028 [P] [US1] Testar o `sessao.service` com Helena mockada. Cenários:
  - sem `companyid` ou `user_id`, ou UUID inválido → `SEM_USUARIO`;
  - empresa não cadastrada → `SEM_CADASTRO`;
  - cliente `INATIVO` → `CLIENTE_INATIVO`;
  - agente encontrado em `/agent/{id}` → ok;
  - agente encontrado só na lista por `id` ou `userId` → ok;
  - agente desconhecido → `AGENTE_DESCONHECIDO`;
  - Helena com timeout de 5 s → `HELENA_INDISPONIVEL`;
  - Helena 401/403 → `HELENA_RECUSOU_TOKEN`;
  - cache curto evita a segunda chamada.

  Arquivo: `backend/tests/services/sessao.service.spec.ts`
- [X] T029 [P] [US1] Testar o `preHandler`. Cenários:
  - sem Bearer → 401 `SESSAO_INVALIDA`;
  - `companyid` em query, params ou body diferente do `cid` → 403 `FORA_DA_EMPRESA`;
  - `:contaId`/`:numeroId` de outra empresa → 403 `FORA_DA_EMPRESA`;
  - `POST /api/sessao` liberado pelo Set de exceções;
  - `EXIGIR_SESSAO=false` libera.

  Arquivo: `backend/tests/adapters/preHandler.spec.ts`

### Implementation for User Story 1
- [X] T030 [US1] Implementar a barreira de embed (hook `onRequest` e `onSend` para a CSP). Comentar no código: "barreira de navegador, NÃO é autenticação". Arquivo: `backend/server/adapters/http/embed.ts`
- [X] T031 [US1] Implementar `emitirSessao` e `verificarSessao` com `base64url(JSON) + "." + HMAC-SHA256(SEGREDO_SESSAO)`, validade de 12 h e `timingSafeEqual`. Arquivo: `backend/server/adapters/http/sessao.ts`
- [X] T032 [P] [US1] Implementar o `HelenaGateway` com axios:
  - base `HELENA_API_URL`; `Authorization: Bearer <token Chatfast decifrado>`; timeout de 5000 ms;
  - `obterAgente(id)` → `GET /core/v1/agent/{id}`, com 404 → null;
  - `listarAgentes()` → `GET /core/v1/agent` (array, sem paginação);
  - mapeia para o tipo `Agente {id, userId, nome, isOwner, profile}`;
  - mapeia 401/403 → `ErroToken` e timeout/5xx → `ErroIndisponivel`.

  Arquivo: `backend/server/adapters/helena/helenaGateway.ts`
- [X] T033 [US1] Implementar o `sessao.service.abrir(companyid, userId)`:
  - busca o cliente;
  - procura o agente por `obterAgente`, com fallback na lista por `id` ou `userId`;
  - mantém cache em memória (`Map` com TTL de 5 min);
  - calcula `admin` (ver T043);
  - emite o token.

  Arquivo: `backend/server/services/sessao.service.ts`
- [X] T034 [US1] Implementar o `ContaRepository` Prisma com: `clientePorCompanyid`, `contaPertence(contaId, companyid)` e `numeroPertence(numeroId, companyid)`. Arquivo: `backend/server/adapters/persistence/prisma/contaRepository.ts`
- [X] T035 [US1] Registrar o `preHandler` em `/api/*`:
  - Set de exceções `{'POST /api/sessao'}`;
  - Bearer → `request.sessao`;
  - `pertenceAEmpresa`, que confere `companyid` em params, query e body e consulta o banco para `:contaId` e `:numeroId`, liberando quando `sessao.admin`;
  - `/api/admin/*` exige `admin`.

  Arquivo: `backend/server/adapters/http/app.ts`
- [X] T036 [US1] Implementar a rota `POST /api/sessao` (fina, valida o body com zod e chama o service), aceitando `companyid`, `company_id`, `user_id`, `userId`, `userid` e `user`. Arquivo: `backend/server/adapters/http/routes/sessao.routes.ts`
- [X] T037 [US1] Implementar o acesso à API no front:
  - `API_URL='/api'`; `idsDaUrl()` lê `company_id`/`companyid` e as variantes de user;
  - `abrirSessao()` grava `axios.defaults.headers.common.Authorization`;
  - interceptor: 401 `SESSAO_INVALIDA` → **uma** renovação compartilhada (promise única + flag `_renovada`) e repete a request; em 5xx anexa `(código: <traceId>)` à mensagem.

  Arquivo: `frontend/src/lib/api.ts`
- [X] T038 [US1] Criar a tela de acesso do dashboard: estados carregando e erro, com mensagem específica por código:
  - `SEM_CADASTRO`: "Conta não cadastrada. Fale com a Fasterisk";
  - `AGENTE_DESCONHECIDO`: "Acesso não autorizado";
  - `HELENA_INDISPONIVEL`: "Não foi possível validar seu acesso agora. Tente novamente", com botão "Tentar de novo";
  - `HELENA_RECUSOU_TOKEN`: "Integração com o Chatfast precisa ser atualizada. Fale com a Fasterisk";
  - `CLIENTE_INATIVO`: "Conta desativada. Fale com a Fasterisk".

  Arquivo: `frontend/src/features/dashboard/AcessoDashboard.tsx`
- [X] T039 [US1] Ao receber `HELENA_RECUSOU_TOKEN`, marcar `cliente.alerta_chatfast` (campo boolean novo, default false, com migration) para o admin exibir o alerta (EC-06). Arquivos: `backend/server/services/sessao.service.ts`, `backend/prisma/schema.prisma`

**Checkpoint**: um cliente cadastrado via seed abre o dashboard vazio, e outra empresa é bloqueada.

---

## Phase 4: User Story 2 - Acesso ao painel admin restrito à Fasterisk (P1)

**Goal**: `/admin` acessível só por quem é admin na Helena da conta da Fasterisk.

**Independent Test**: um agente admin da Fasterisk abre o `/admin`. Um agente comum da Fasterisk vê "Sem permissão de administrador". Um agente de cliente recebe 403 em `/api/admin/*`.

### Tests for User Story 2 ⚠️
- [X] T040 [P] [US2] Testar a regra `ehAdmin`:
  - `companyid ∉ ADMIN_COMPANYIDS` → false;
  - `∈` e `isOwner` → true;
  - `∈` e `profile` em `PERFIS_ADMIN` → true;
  - `∈` e agente comum → false.

  Arquivo: `backend/tests/services/sessao.admin.spec.ts`
- [X] T041 [P] [US2] Testar que toda rota `/api/admin/*` sem `admin` responde 403 `SEM_PERMISSAO_ADMIN` (iterar sobre as rotas registradas). Arquivo: `backend/tests/adapters/admin.guard.spec.ts`

### Implementation for User Story 2
- [ ] T042 [US2] Levantar com uma chamada real os valores de `profile` dos agentes da conta da Fasterisk (research R-07) e registrar o resultado no research.md. Arquivo: `specs/001-consumo-meta/research.md`
- [X] T043 [US2] Implementar `ehAdmin(companyid, agente) = ADMIN_COMPANYIDS.includes(companyid) && (agente.isOwner || PERFIS_ADMIN.has(agente.profile))`, com a constante `PERFIS_ADMIN` marcada `ponytail:` (valores levantados em T042). Arquivo: `backend/server/services/sessao.service.ts`
- [X] T044 [US2] Criar o shell do admin: abre a sessão, mostra "Sem permissão de administrador" quando `admin=false` e o layout lista/detalhe quando `true`. Arquivo: `frontend/src/features/admin/AdminApp.tsx`

**Checkpoint**: US1 e US2 funcionam sozinhas. A segurança do MVP está completa.

---

## Phase 5: User Story 3 - Cadastro de cliente (P2)

**Goal**: o admin cadastra, edita e troca o token Chatfast de clientes.

**Independent Test**: cadastrar um cliente no `/admin` e abrir o dashboard dele pelo embed.

### Tests for User Story 3 ⚠️
- [X] T045 [P] [US3] Testar o `clientes.service`. Cenários:
  - criar com nome entre 1 e 120 caracteres, `companyid` UUID e token → status `ATIVO` e auditoria `cliente.criar` sem token;
  - `companyid` duplicado → `DUPLICADO`;
  - UUID inválido → `VALIDACAO`;
  - a resposta nunca contém token, só `tokenChatfastUltimos4`;
  - trocar o token → auditoria `cliente.trocar_token_chatfast` com `{ultimos4}`.

  Arquivo: `backend/tests/services/clientes.service.spec.ts`

### Implementation for User Story 3
- [X] T046 [US3] Implementar o `clientes.service`:
  - `listar` (com `contas`, `piorStatus` pela ordem `TOKEN_INVALIDO > ERRO_SYNC > PAUSADA > TOKEN_EXPIRANDO > ATIVA`, `ultimoSync` e `alerta`);
  - `criar`, que valida o token com `helena.listarAgentes()`, cifra e grava `ultimos4`;
  - `detalhar`;
  - `atualizar` (nome, token).

  Arquivo: `backend/server/services/clientes.service.ts`
- [X] T047 [US3] Criar as rotas `GET /api/admin/clientes`, `POST /api/admin/clientes`, `GET /api/admin/clientes/:clienteId` e `PATCH /api/admin/clientes/:clienteId` (nome, tokenChatfast), com zod conforme contracts/api.md. Arquivo: `backend/server/adapters/http/routes/admin.routes.ts`
- [X] T048 [P] [US3] Criar a lista de clientes: tabela com nome, `companyid`, contas, selo do pior status, último sync e selo de alerta; botão "Novo cliente". Arquivo: `frontend/src/features/admin/ListaClientes.tsx`
- [X] T049 [P] [US3] Criar o formulário de cliente (modal): nome, `companyid` e token Chatfast (input password, nunca preenchido na edição, com placeholder `••••<ultimos4>`). Mostra erros por campo. Arquivo: `frontend/src/features/admin/FormCliente.tsx`
- [X] T050 [US3] Criar o detalhe do cliente: cabeçalho com os dados e a troca do token Chatfast, e o espaço para a lista de contas (US4/US13). Arquivo: `frontend/src/features/admin/DetalheCliente.tsx`

---

## Phase 6: User Story 4 - Cadastro de conta WABA com validação e descoberta de números (P2)

**Goal**: vincular uma WABA validando o token e descobrindo os números.

**Independent Test**: cadastrar uma WABA com token válido e ver os números no detalhe do cliente.

### Tests for User Story 4 ⚠️
- [X] T051 [P] [US4] Criar fixtures **com a forma real** documentada no research.md: `debug_token` (válido, expirado, sem escopo), `GET /{waba}?fields=name,currency,timezone_id` e `phone_numbers` com `paging.cursors` e `paging.next`. Arquivos: `backend/tests/fixtures/meta/*.json`
- [X] T052 [P] [US4] Testar o `metaGraphGateway` com axios mockado. Cenários:
  - token enviado só no header `Authorization: Bearer`, nunca na URL;
  - segue `paging.next` até o fim;
  - `quality_rating` `NA` ou ausente → `UNKNOWN`;
  - erro 190 → `ErroToken`;
  - `debug_token` `is_valid=false` → `ErroToken` com motivo;
  - sem `whatsapp_business_management` → `ErroToken('escopo ausente')`;
  - `expires_at=0` → `expiraEm=null`.

  Arquivo: `backend/tests/adapters/metaGraphGateway.spec.ts`
- [X] T053 [P] [US4] Testar o `contas.service.criar`. Cenários:
  - WABA duplicada → `DUPLICADO`;
  - token inválido → `TOKEN_META_INVALIDO` com o motivo;
  - sucesso grava `moeda`, `fuso` (`timezone_id` → IANA, fallback `America/Fortaleza`), `token_expira_em`, `ultimos4` e os números, deixa `historico_desde=null` e registra auditoria `conta.criar`.

  Arquivo: `backend/tests/services/contas.service.spec.ts`

### Implementation for User Story 4
- [X] T054 [US4] Implementar o `metaGraphGateway` (único lugar que fala com graph.facebook.com):
  - base `https://graph.facebook.com/${META_GRAPH_VERSION}`; timeout de 20 s; token só no header;
  - `validarToken` via `/debug_token?input_token=` com o próprio token como `access_token` (R-08, `ponytail:` "auto-inspeção; app token se a Meta recusar");
  - `obterWaba` (`name`, `currency`, `timezone_id`);
  - `listarNumeros` com paginação;
  - converte o JSON cru em tipos nossos.

  Arquivo: `backend/server/adapters/meta/metaGraphGateway.ts`
- [X] T055 [US4] Implementar o `contas.service.criar(clienteId, {wabaId, token, nome?})`: valida → obtém a WABA → lista números → grava conta e números numa transação → auditoria. Arquivo: `backend/server/services/contas.service.ts`
- [X] T056 [US4] Criar a rota `POST /api/admin/clientes/:clienteId/contas`. Arquivo: `backend/server/adapters/http/routes/admin.routes.ts`
- [X] T057 [P] [US4] Criar o formulário de conta WABA: WABA ID e Access Token, com aviso "Use System User token (não expira)". Mostra o motivo da recusa do token. Arquivo: `frontend/src/features/admin/FormConta.tsx`
- [X] T058 [US4] Criar o cartão da conta no detalhe do cliente: status, `tokenUltimos4`, expiração (com o aviso de System User quando houver expiração) e a lista de números com nome verificado e qualidade. Arquivo: `frontend/src/features/admin/ContaWaba.tsx`

---

## Phase 7: User Story 5 - Coleta automática e periódica do consumo (P3)

**Goal**: o cron coleta `pricing_analytics` e `analytics` de todas as contas coletáveis, com lock, janela, upsert idempotente e status.

**Independent Test**: com a Meta mockada, rodar `executarTick()` e verificar as linhas gravadas, `execucao_sync` e os status.

### Tests for User Story 5 ⚠️
- [X] T059 [P] [US5] Criar fixtures reais (forma do research R-01/R-04):
  - `pricing_analytics` com `data[].data_points[]` (`start`, `end`, `phone_number`, `country`, `pricing_category`, `pricing_type`, `tier`, `volume`, `cost`), incluindo um ponto **sem `cost`** e as categorias `MARKETING_LITE` e `REFERRAL_CONVERSION`;
  - `analytics` com `data_points[{start, end, sent, delivered}]`;
  - erro 190, erro 80008 e o header `X-Business-Use-Case-Usage` em 85%.

  Arquivos: `backend/tests/fixtures/meta/pricing_analytics*.json`, `backend/tests/fixtures/meta/analytics*.json`, `backend/tests/fixtures/meta/erros*.json`
- [X] T060 [P] [US5] Testar a janela do sync:
  - `historicoDesde=null` → backfill de `SYNC_DIAS_BACKFILL` dias, limitado a 365;
  - senão, os últimos `SYNC_DIAS_REPROCESSO` dias até hoje no fuso da conta;
  - reativação → desde `inativo_desde`, limitado a 365;
  - `start`/`end` unix calculados no fuso.

  Arquivo: `backend/tests/domain/sync/janela.spec.ts`
- [X] T061 [P] [US5] Testar a normalização da Meta:
  - `start` unix → data no fuso da conta;
  - categoria desconhecida → `OUTRA`;
  - `pricing_type` desconhecido → `OUTRO`;
  - `cost` ausente → `custo=null` (**não** 0);
  - `country`/`tier` ausentes → `''`;
  - aceita `phone_number` ou `phone`.

  Arquivo: `backend/tests/domain/sync/normalizacao.spec.ts`
- [X] T062 [P] [US5] Testar o mapeamento de erros: 190/102/463/467 → `TOKEN_INVALIDO` sem retry; 4/80007/80008 → retry com backoff de 2/4/8 s e depois `ERRO_SYNC` "limite da Meta"; timeout/5xx → `ERRO_SYNC`. Arquivo: `backend/tests/domain/sync/erros.spec.ts`
- [X] T063 [P] [US5] Testar o `sync.service` com repositórios e gateway mockados. Cenários:
  - lock ocupado → execução `IGNORADA`, sem chamar a Meta;
  - sucesso → upsert, `ultimo_sync_em`, status `ATIVA`, `desatualizado_desde=null`, `historico_desde` preenchido e execução `OK` com `linhas`;
  - dois syncs iguais → mesmos totais (FR-028);
  - erro na conta A não impede a conta B (FR-033);
  - volume > 0 com `cost` ausente em todos os pontos → `sem_custo_meta=true`;
  - número com `coleta_ativa=false` não é coletado;
  - conta `PAUSADA` ou cliente `INATIVO` fora do tick;
  - número novo na Meta é criado;
  - número sumido → `nao_encontrado_na_meta=true`;
  - o lock é liberado mesmo com exceção.

  Arquivo: `backend/tests/services/sync.service.spec.ts`
- [X] T064 [P] [US5] Testar a checagem diária de expiração: expira em ≤ 7 dias → `TOKEN_EXPIRANDO`; `is_valid=false` → `TOKEN_INVALIDO` com `desatualizado_desde`. Arquivo: `backend/tests/services/expiracao.spec.ts`

### Implementation for User Story 5
- [X] T065 [P] [US5] Implementar `calcularJanela(conta, hoje, env)`, que devolve `{de, ate, startUnix, endUnix}`. Arquivo: `backend/server/domain/sync/janela.ts`
- [X] T066 [P] [US5] Implementar o mapeamento de erros: `statusPorErro(erro)` e `deveRetentar(erro, tentativa)`. Arquivo: `backend/server/domain/sync/erros.ts`
- [X] T067 [P] [US5] Implementar as transições de status conforme o data-model.md: `coletavel(conta, cliente)`, `aposSucesso(conta)` (mantém `TOKEN_EXPIRANDO`) e `aposErro(conta, status)` (preenche `desatualizado_desde` se ainda for null). Arquivo: `backend/server/domain/sync/status.ts`
- [X] T068 [US5] Adicionar ao `metaGraphGateway`:
  - `pricingAnalytics(wabaId, startUnix, endUnix)` com `granularity(DAILY).dimensions(PHONE,PRICING_CATEGORY,PRICING_TYPE,COUNTRY,TIER)`;
  - `analytics(wabaId, phoneDisplay, startUnix, endUnix)` com `granularity(DAY)`;
  - seguir `paging.next` defensivamente;
  - ler `X-Business-Use-Case-Usage` e, acima de 80%, aguardar 2 s entre chamadas;
  - normalizar para `PontoPreco` e `PontoEnvio` (R-01, R-04, R-09).

  Arquivo: `backend/server/adapters/meta/metaGraphGateway.ts`
- [X] T069 [US5] Implementar a normalização pura usada pelo gateway (data no fuso com `date-fns`/`Intl`, enums e custo null). Arquivo: `backend/server/domain/sync/normalizacao.ts`
- [X] T070 [US5] Implementar o `ConsumoRepository` Prisma:
  - `upsertConsumo(linhas)` e `upsertMensagens(linhas)` em lote com `ON CONFLICT DO UPDATE`;
  - `adquirirLock(contaId)` com o UPDATE condicional do data-model.md (30 min);
  - `liberarLock`;
  - `gravarExecucao`.

  Arquivo: `backend/server/adapters/persistence/prisma/consumoRepository.ts`
- [X] T071 [US5] Implementar o `sync.service.sincronizarConta(contaId, origem)` conforme o plan.md "Sync: fluxo de um tick", passos 2.1 a 2.7, com o span OTel `sync conta` e `try/finally` para o lock. Arquivo: `backend/server/services/sync.service.ts`
- [X] T072 [US5] Implementar `executarTick()`, que percorre as contas coletáveis em sequência (`ponytail:` "sequencial; paralelizar com limite se o tick passar de 50% do intervalo; fila só se ainda estourar") e manda o pulso para `HEARTBEAT_URL` (`/fail` se o tick lançar). Arquivo: `backend/server/services/sync.service.ts`
- [X] T073 [US5] Implementar `verificarExpiracoes()`, a checagem diária via `validarToken`. Arquivo: `backend/server/services/sync.service.ts`
- [X] T074 [US5] Disparar o backfill logo após `contas.service.criar`: `sincronizarConta(id,'ADMIN')` sem `await`, com erro logado. Arquivo: `backend/server/services/contas.service.ts`
- [ ] T075 [US5] Validar com uma WABA real (R-01 chave do número, R-05 fuso dos buckets, R-08 debug_token, R-12 custo), atualizar o research.md e substituir as fixtures por respostas reais anonimizadas. Arquivos: `specs/001-consumo-meta/research.md`, `backend/tests/fixtures/meta/`
- [X] T076 [US5] Agendar no boot: `cron.schedule(SYNC_CRON, executarTick)` e `cron.schedule('0 6 * * *', verificarExpiracoes)`, ambos com timezone `America/Fortaleza` e um guard que impede um tick sobrepor outro. Arquivo: `backend/server/index.ts`

**Checkpoint**: a coleta preenche o banco. A partir daqui, o dashboard tem dados reais.

---

## Phase 8: User Story 6 - Indicadores principais do dashboard (P4)

**Goal**: cards Enviadas, Entregues, Taxa, Média diária e Pico, mais o cabeçalho com última sincronização e o aviso de dia parcial.

**Independent Test**: com dados conhecidos (seed), conferir os 5 cards.

### Tests for User Story 6 ⚠️
- [X] T077 [P] [US6] Testar a agregação de envio:
  - totais, `naoEntregues`;
  - `taxaEntrega=null` quando `enviadas=0`;
  - média = enviadas ÷ `diasComEnvio`;
  - "X de Y dias com envio";
  - pico e data;
  - `incluiHoje` no fuso da conta.

  Arquivo: `backend/tests/domain/consumo/agregacaoEnvio.spec.ts`
- [X] T078 [P] [US6] Testar o isolamento do dashboard: com repositório em memória com linhas das empresas A e B, `resumo`, `filtros`, `status` e o export da sessão A nunca retornam linhas de B; `companyid` de B na query → 403. Arquivo: `backend/tests/adapters/isolamento.spec.ts`

### Implementation for User Story 6
- [X] T079 [P] [US6] Implementar `agregarEnvio(linhasMensagens, periodo, hoje)`. Arquivo: `backend/server/domain/consumo/agregacao.ts`
- [X] T080 [US6] Implementar a query `$queryRaw` de `mensagens_diarias` agrupada por `(data, numero_id)` com `WHERE companyid = $1 AND data BETWEEN $2 AND $3` e os filtros opcionais de conta e número. Arquivo: `backend/server/adapters/persistence/prisma/consumoRepository.ts`
- [X] T081 [US6] Implementar o `dashboard.service.resumo(companyid, filtros)` (a parte de envio, mais `periodo` e `ultimoSync`). Arquivo: `backend/server/services/dashboard.service.ts`
- [X] T082 [US6] Criar a rota `GET /api/dashboard/resumo`, que valida `de ≤ ate` e no máximo 366 dias. O admin pode passar `companyid`. Arquivo: `backend/server/adapters/http/routes/dashboard.routes.ts`
- [X] T083 [P] [US6] Criar a página do dashboard: título "Consumo WhatsApp Cloud API", "Última sincronização: <data e hora>" e o aviso "Dados de hoje são parciais e podem ser revisados pela Meta" quando `incluiHoje`. Layout para largura de iframe. Arquivo: `frontend/src/features/dashboard/DashboardPage.tsx`
- [X] T084 [P] [US6] Criar os 5 cards de envio conforme o mockup (taxa em verde). Arquivo: `frontend/src/features/dashboard/CardsEnvio.tsx`

---

## Phase 9: User Story 7 - Consumo por categoria de cobrança com custo em R$ (P4)

**Goal**: 4 cards de categoria e o card Total, com custo em R$ pela cotação do dia e as situações completo, parcial, indisponível e sem cotação.

**Independent Test**: com dados e cotações conhecidos, conferir os cards.

### Tests for User Story 7 ⚠️
- [X] T085 [P] [US7] Testar o agrupamento das categorias: `MARKETING`/`MARKETING_LITE` → Marketing; `AUTHENTICATION`/`AUTHENTICATION_INTERNATIONAL` → Autenticação; `SERVICE`/`REFERRAL_CONVERSION` → Serviço; `OUTRA` só no total; `REGULAR` = cobrada; `FREE_*` = gratuita. Arquivo: `backend/tests/domain/consumo/categorias.spec.ts`
- [X] T086 [P] [US7] Testar a cotação do dia. Cenários:
  - escolhe a de maior `vigenteDesde ≤ D`;
  - D anterior a todas → usa a mais antiga com `convertidoComCotacaoPosterior=true`;
  - lista vazia → `sem_cotacao`;
  - moeda `BRL` → sem conversão;
  - moeda que não é BRL nem USD → `indisponivel`.

  Arquivo: `backend/tests/domain/consumo/cotacao.spec.ts`
- [X] T087 [P] [US7] Testar o custo e o percentual:
  - custo null ≠ 0;
  - período misto → `parcial` com `diasSemCusto`;
  - todo null → `indisponivel`;
  - percentual por categoria;
  - `custoMedioPorCobradaBrl` = custo ÷ cobradas (null se não houver cobradas);
  - soma em Decimal sem erro de ponto flutuante (strings com 6 casas).

  Arquivo: `backend/tests/domain/consumo/agregacaoCusto.spec.ts`

### Implementation for User Story 7
- [X] T088 [P] [US7] Implementar `grupoDaCategoria`, `ehCobrada` e a ordem/cor dos grupos (Marketing rosa, Utility azul, Autenticação laranja, Serviço verde). Arquivo: `backend/server/domain/consumo/categorias.ts`
- [X] T089 [P] [US7] Implementar `cotacaoDoDia(cotacoes, data)` e `converter(custo, moeda, cotacao)`. A aritmética decimal usa inteiros em micro-unidades (`BigInt`) para não precisar de lib (`ponytail:`). Arquivo: `backend/server/domain/consumo/cotacao.ts`
- [X] T090 [US7] Implementar `agregarCategorias(linhasConsumo, cotacoes)` e `total`, com `custoSituacao`. Arquivo: `backend/server/domain/consumo/agregacao.ts`
- [X] T091 [US7] Implementar a query `$queryRaw` de `consumo_diario` agrupada por `(data, numero_id, categoria, tipo_preco, moeda)` com `sum(volume)`, `sum(custo)` e `count(*) filter (where custo is null)`. Arquivo: `backend/server/adapters/persistence/prisma/consumoRepository.ts`
- [X] T092 [US7] Incluir `categorias` e `total` no `dashboard.service.resumo`. Arquivo: `backend/server/services/dashboard.service.ts`
- [X] T093 [P] [US7] Criar os cards de categoria e o card Total conforme o mockup, com:
  - custo "—" e tooltip "A Meta não informa custo para esta conta";
  - "Custo parcial (X dias sem custo)";
  - "Indisponível (cotação não cadastrada)";
  - marca "convertido com cotação posterior";
  - rótulo "estimado".

  Arquivo: `frontend/src/features/dashboard/CardsCategoria.tsx`

---

## Phase 10: User Story 8 - Gráficos diários (P4)

**Goal**: "Categorias por dia" (empilhado, Volume/Custo) e "Mensagens por dia" (Barras/Linha), com notas.

**Independent Test**: com dados de vários dias, alternar os modos e conferir os valores.

### Tests for User Story 8 ⚠️
- [X] T094 [P] [US8] Testar as séries: todos os dias do período presentes (inclusive os zerados), em ordem crescente, com custo por categoria em R$ e enviadas/entregues por dia. Arquivo: `backend/tests/domain/consumo/series.spec.ts`

### Implementation for User Story 8
- [X] T095 [US8] Implementar `serieCategorias` e `serieMensagens` e incluí-las no `resumo`. Arquivos: `backend/server/domain/consumo/agregacao.ts`, `backend/server/services/dashboard.service.ts`
- [X] T096 [P] [US8] Criar o gráfico "Categorias por dia" com shadcn chart (`BarChart` empilhado), toggle Volume/Custo, legenda e a nota de rodapé da US-08 #4. Arquivo: `frontend/src/features/dashboard/GraficoCategorias.tsx`
- [X] T097 [P] [US8] Criar o gráfico "Mensagens por dia" (barras lado a lado ou linha), toggle Barras/Linha e a nota "entregues podem superar enviadas…". Arquivo: `frontend/src/features/dashboard/GraficoMensagens.tsx`

---

## Phase 11: User Story 9 - Consumo por número (P4)

**Goal**: tabela por número conforme o mockup.

**Independent Test**: com 2 números de dados conhecidos, conferir a tabela.

### Tests for User Story 9 ⚠️
- [X] T098 [P] [US9] Testar `porNumero`: números sem consumo aparecem com zeros; `percentualDoTotal` soma 1 (ou é null sem custo); taxa por número; volume por grupo. Arquivo: `backend/tests/domain/consumo/porNumero.spec.ts`

### Implementation for User Story 9
- [X] T099 [US9] Implementar `agregarPorNumero(numeros, consumo, mensagens, cotacoes)` e incluir no `resumo`. Arquivos: `backend/server/domain/consumo/agregacao.ts`, `backend/server/services/dashboard.service.ts`
- [X] T100 [P] [US9] Criar a tabela "Consumo por número": WABA, Número, Nome verificado, selo de Qualidade (GREEN/YELLOW/RED/UNKNOWN), Enviadas, Entregues, Taxa, os 4 grupos, Custo e % do total com barra, mais o contador "N número(s)". Arquivo: `frontend/src/features/dashboard/TabelaNumeros.tsx`

---

## Phase 12: User Story 10 - Filtros do dashboard (P5)

**Goal**: filtros WABA, Número, Categoria e Início/Fim, atalhos e botão Aplicar, persistidos no `sessionStorage`.

**Independent Test**: aplicar combinações e conferir que todos os blocos refletem o recorte, e que os filtros sobrevivem à recriação do iframe.

### Tests for User Story 10 ⚠️
- [X] T101 [P] [US10] Testar os presets de período no fuso da conta: 7d, 30d, 90d, mês atual (padrão) e mês anterior, incluindo as bordas de meia-noite (23:59 e 00:01 em `America/Fortaleza`) e a virada de mês e de ano. Arquivo: `backend/tests/domain/consumo/periodo.spec.ts`
- [X] T102 [P] [US10] Testar os filtros combinados (conta + número + categoria) aplicados a consumo, mensagens e séries. Arquivo: `backend/tests/domain/consumo/filtros.spec.ts`
- [X] T103 [P] [US10] Testar o componente de filtros: um atalho preenche as datas; `de > ate` mostra o erro e não chama a API; Aplicar faz **uma** chamada. Arquivo: `frontend/src/features/dashboard/Filtros.spec.tsx`

### Implementation for User Story 10
- [X] T104 [P] [US10] Implementar `presetPeriodo(preset, agora, fuso)` → `{de, ate}`. É compartilhado por cópia: o front tem a sua própria versão, porque não há import cruzado. Arquivos: `backend/server/domain/consumo/periodo.ts`, `frontend/src/features/dashboard/periodo.ts`
- [X] T105 [US10] Implementar o `dashboard.service.filtros(companyid)` e a rota `GET /api/dashboard/filtros` (contas, números, categorias, `historicoDesde`). Arquivos: `backend/server/services/dashboard.service.ts`, `backend/server/adapters/http/routes/dashboard.routes.ts`
- [X] T106 [US10] Criar os filtros:
  - selects WABA, Número (filtrado pela WABA) e Categoria;
  - `<input type="date">` de início e fim;
  - atalhos 7d, 30d, 90d, Mês atual e Mês anterior;
  - botão Aplicar;
  - estado em `telaPersistida`.

  Arquivo: `frontend/src/features/dashboard/Filtros.tsx`
- [X] T107 [US10] Ligar os filtros ao `resumo` no DashboardPage (uma chamada por Aplicar). Mostrar o estado vazio "Nenhum consumo no período selecionado", "Coletando histórico. Os dados aparecerão em instantes" quando `coletandoHistorico`, e "Dados disponíveis a partir de DD/MM" quando `de < historicoDesde`. Arquivo: `frontend/src/features/dashboard/DashboardPage.tsx`

---

## Phase 13: User Story 11 - Sincronização manual pelo cliente (P6)

**Goal**: o botão "Sincronizar com a Meta" respeita 15 min por conta, com polling de status.

**Independent Test**: clicar, ver "Sincronizando…", ver a atualização e ver o botão bloqueado com "Disponível em X min".

### Tests for User Story 11 ⚠️
- [X] T108 [P] [US11] Testar o `dashboard.service.sincronizar`:
  - `ultimo_sync_em` há menos de 15 min → `SYNC_AGUARDE` com `disponivelEm`;
  - lock ocupado → `SYNC_EM_ANDAMENTO`;
  - contas `TOKEN_INVALIDO`/`PAUSADA` ignoradas;
  - sucesso dispara `sincronizarConta(id,'CLIENTE')` sem aguardar.

  Arquivo: `backend/tests/services/dashboard.sincronizar.spec.ts`

### Implementation for User Story 11
- [X] T109 [US11] Implementar `dashboard.service.status(companyid)` (`ultimoSync`, `sincronizando`, `sincronizarDisponivelEm`, `desatualizadoDesde`, `coletandoHistorico`) e `sincronizar(companyid)`. Arquivo: `backend/server/services/dashboard.service.ts`
- [X] T110 [US11] Criar as rotas `GET /api/dashboard/status` e `POST /api/dashboard/sincronizar` (202). Arquivo: `backend/server/adapters/http/routes/dashboard.routes.ts`
- [X] T111 [P] [US11] Criar o botão de sincronizar:
  - desabilitado com "Disponível em X min" (contagem por minuto);
  - "Sincronizando…" com polling de `/status` a cada 3 s;
  - ao terminar, recarrega o resumo e mostra um toast;
  - em erro, toast de erro e mantém os dados.

  Arquivo: `frontend/src/features/dashboard/BotaoSincronizar.tsx`

---

## Phase 14: User Story 12 - Cotação USD → BRL com vigência (P6)

**Goal**: o admin cadastra cotações com vigência, e o histórico não muda.

**Independent Test**: cadastrar duas cotações e conferir o custo de dias antes e depois da troca no dashboard.

### Tests for User Story 12 ⚠️
- [X] T112 [P] [US12] Testar o `cotacoes.service`: `valor > 0` com até 4 casas; `vigenteDesde` igual a uma existente substitui e audita `cotacao.substituir`; criar audita `cotacao.criar` com autor; listar em ordem da mais nova para a mais antiga. Arquivo: `backend/tests/services/cotacoes.service.spec.ts`

### Implementation for User Story 12
- [X] T113 [US12] Implementar o `cotacoes.service` (`listar`, `criar` com upsert por `vigente_desde`, `vigente`) e usar as cotações no `dashboard.service.resumo`. Arquivos: `backend/server/services/cotacoes.service.ts`, `backend/server/services/dashboard.service.ts`
- [X] T114 [US12] Criar as rotas `GET /api/admin/cotacoes`, `POST /api/admin/cotacoes` e `GET /api/admin/painel` (`contasComProblema`, `cotacaoVigente`, `semCotacao`). Arquivo: `backend/server/adapters/http/routes/admin.routes.ts`
- [X] T115 [P] [US12] Criar o card "Cotação USD → BRL vigente": valor e data, histórico em tabela e formulário (valor, `<input type="date">` de vigência), mais o alerta "Cadastre a cotação" quando `semCotacao`. Arquivo: `frontend/src/features/admin/Cotacoes.tsx`

---

## Phase 15: User Story 13 - Gestão operacional das contas no admin (P7)

**Goal**: testar, sincronizar agora, trocar token, pausar e retomar, atualizar números, ativar e desativar números, execuções, contador de problemas e alertas.

**Independent Test**: com uma conta em erro, ver o alerta na lista, abrir o detalhe e executar cada ação.

### Tests for User Story 13 ⚠️
- [X] T116 [P] [US13] Testar as ações de conta. Cenários:
  - trocar o token: inválido → `TOKEN_META_INVALIDO`; válido → `ATIVA`, `desatualizado_desde=null` e auditoria `conta.trocar_token` com `{ultimos4}`;
  - pausar → `PAUSADA` com `desatualizado_desde`;
  - retomar → `ATIVA`;
  - testar não grava fatos;
  - sincronizar como admin não aplica o limite de 15 min, mas respeita o lock (`SYNC_EM_ANDAMENTO`);
  - atualizar números marca os sumidos;
  - `PATCH` de número muda `coleta_ativa` e audita.

  Arquivo: `backend/tests/services/contas.acoes.spec.ts`

### Implementation for User Story 13
- [X] T117 [US13] Implementar no `contas.service`: `atualizar` (token, pausada, nome), `testar`, `sincronizarAgora`, `atualizarNumeros`, `execucoes(limite=20)` e `alternarNumero`. Arquivo: `backend/server/services/contas.service.ts`
- [X] T118 [US13] Criar as rotas:
  - `PATCH /api/admin/contas/:contaId`;
  - `POST /api/admin/contas/:contaId/testar`;
  - `POST /api/admin/contas/:contaId/sincronizar` (202);
  - `POST /api/admin/contas/:contaId/atualizar-numeros`;
  - `GET /api/admin/contas/:contaId/execucoes`;
  - `PATCH /api/admin/numeros/:numeroId`.

  Arquivo: `backend/server/adapters/http/routes/admin.routes.ts`
- [X] T119 [US13] Completar o cartão da conta:
  - botões Testar conexão, Sincronizar agora, Trocar token, Pausar/Retomar e Atualizar números;
  - chave por número, com o selo "não encontrado na Meta";
  - último erro;
  - marca "sem custo da Meta";
  - tabela das últimas execuções (origem, início, fim, status, janela, linhas, erro).

  Arquivo: `frontend/src/features/admin/ContaWaba.tsx`
- [X] T120 [US13] Mostrar no topo da lista de clientes o contador "contas com problema" (vindo de `/api/admin/painel`) e o alerta do Chatfast (`alertaChatfast`). Arquivo: `frontend/src/features/admin/ListaClientes.tsx`

---

## Phase 16: User Story 14 - Aviso de dados desatualizados para o cliente (P7)

**Goal**: mostrar a faixa amarela quando alguma conta está em `TOKEN_INVALIDO`, `ERRO_SYNC` ou `PAUSADA`.

**Independent Test**: colocar uma conta em `TOKEN_INVALIDO` e abrir o dashboard do cliente.

### Tests for User Story 14 ⚠️
- [X] T121 [P] [US14] Testar `desatualizadoDesde`: é o menor `desatualizado_desde` entre as contas com problema; null quando todas estão em `ATIVA`/`TOKEN_EXPIRANDO`. Arquivo: `backend/tests/services/dashboard.status.spec.ts`

### Implementation for User Story 14
- [X] T122 [P] [US14] Criar a faixa amarela "Dados desatualizados desde DD/MM. A Fasterisk já foi notificada.", lida de `/api/dashboard/status` (sem e-mail ou mensagem, FR-048). Arquivo: `frontend/src/features/dashboard/FaixaDesatualizado.tsx`

---

## Phase 17: User Story 15 - Exportação em Excel e PDF (P8)

**Goal**: Excel com 3 abas no backend e PDF via impressão do dashboard (R-10).

**Independent Test**: aplicar um filtro, exportar os dois formatos e conferir que batem com a tela.

### Tests for User Story 15 ⚠️
- [X] T123 [P] [US15] Testar o `exportacao.service` lendo o buffer gerado com exceljs:
  - abas "Resumo", "Por número" e "Diário";
  - colunas da aba Diário: data, conta, número, categoria, volume, cobradas, gratuitas, `custo_moeda_conta`, moeda, cotação, `custo_brl`, situação;
  - custo null aparece como "indisponível", nunca 0;
  - totais iguais ao `resumo`;
  - recorte vazio → linha "Nenhum consumo no período";
  - só dados da empresa da sessão.

  Arquivo: `backend/tests/services/exportacao.service.spec.ts`

### Implementation for User Story 15
- [X] T124 [US15] Implementar o `exportacao.service.xlsx(companyid, filtros)` reutilizando o `dashboard.service.resumo` e a query diária. Arquivo: `backend/server/services/exportacao.service.ts`
- [X] T125 [US15] Criar a rota `GET /api/dashboard/exportar.xlsx` com `Content-Disposition: attachment; filename="consumo-<empresa>-<de>-<ate>.xlsx"`. Arquivo: `backend/server/adapters/http/routes/dashboard.routes.ts`
- [X] T126 [P] [US15] Criar os botões Exportar Excel (download via axios blob) e Exportar PDF (`window.print()`). Arquivo: `frontend/src/features/dashboard/BotoesExportar.tsx`
- [X] T127 [P] [US15] Criar a folha `@media print`:
  - esconde filtros, botões e a faixa;
  - mostra o cabeçalho do relatório (cliente, período, filtros, "dados até <ultimoSync>");
  - A4 em retrato, com quebra de página antes da tabela;
  - nota "custo estimado".

  Arquivos: `frontend/src/features/dashboard/print.css`, `frontend/src/features/dashboard/CabecalhoRelatorio.tsx`
- [ ] T128 [US15] Validar o `window.print()` dentro do iframe real do Chatfast (R-10). Se for bloqueado (sandbox sem `allow-modals`), registrar no research.md e abrir uma task de PDF no servidor. Arquivo: `specs/001-consumo-meta/research.md`

---

## Phase 18: User Story 16 - Desativação e reativação de cliente (P9)

**Goal**: desativar para a coleta e bloquear o acesso, mantendo os dados. Reativar retoma e reprocessa.

**Independent Test**: desativar, tentar abrir o dashboard, reativar e ver a coleta voltar.

### Tests for User Story 16 ⚠️
- [X] T129 [P] [US16] Testar o ciclo de vida:
  - desativar → `INATIVO`, `inativo_desde=hoje`, tokens mantidos, auditoria `cliente.desativar`, contas fora do tick e sessão → `CLIENTE_INATIVO`;
  - reativar → `ATIVO`, a próxima janela começa em `inativo_desde` (limitada a 365), `inativo_desde=null` após o sync OK e auditoria `cliente.reativar`.

  Arquivo: `backend/tests/services/clientes.ciclo.spec.ts`

### Implementation for User Story 16
- [X] T130 [US16] Implementar `status` no `clientes.service.atualizar` (`ATIVO`/`INATIVO`, com `inativo_desde`) e disparar `sincronizarConta` das contas ao reativar. Arquivo: `backend/server/services/clientes.service.ts`
- [X] T131 [P] [US16] Adicionar o botão "Desativar"/"Reativar" no detalhe do cliente, com confirmação e selo "Inativo" na lista. Arquivos: `frontend/src/features/admin/DetalheCliente.tsx`, `frontend/src/features/admin/ListaClientes.tsx`

---

## Phase 19: Polish & Cross-Cutting Concerns

- [X] T132 [P] Testar que nenhum log contém token: capturar a saída do pino durante erros simulados do axios (Meta e Helena) e procurar o token e `access_token=`. Arquivo: `backend/tests/adapters/logger.spec.ts`
- [X] T133 [P] Adicionar o atalho "ver dashboard" do admin: na lista de clientes, um link que abre o dashboard do cliente no próprio admin, passando `companyid` (o admin pode). Arquivos: `frontend/src/features/admin/ListaClientes.tsx`, `frontend/src/lib/api.ts`
- [ ] T134 [P] Revisar o layout em largura de iframe (360–1280 px): os cards quebram em grid responsivo e as tabelas têm scroll horizontal. Sem `window.top`. Arquivos: `frontend/src/features/dashboard/*.tsx`, `frontend/src/features/admin/*.tsx`
- [X] T135 Medir o `GET /api/dashboard/resumo` com seed de 90 dias × 20 números × 7 categorias (SC-04 ≤ 2 s) e o export (SC-12 ≤ 10 s). Registrar o resultado no quickstart.md. Arquivo: `specs/001-consumo-meta/quickstart.md`
- [X] T136 Atualizar a spec (A-02 e a coluna "custo USD" → custo na moeda da conta, conforme R-03) e marcar como resolvidas as pendências A-01 a A-03. Arquivo: `specs/001-consumo-meta/spec.md`
- [ ] T137 Executar o quickstart.md §3 de ponta a ponta com dados reais e marcar o §4 "Pronto quando". Arquivo: `specs/001-consumo-meta/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Ph 1)** → **Foundational (Ph 2)** → bloqueia todas as stories.
- **US1 (Ph 3)** → **US2 (Ph 4)**: o admin usa a sessão.
- **US3 (Ph 5)** depende de US2 (rotas admin). **US4 (Ph 6)** depende de US3.
- **US5 (Ph 7)** depende de US4 (contas e gateway Meta).
- **US6–US9 (Ph 8–11)** dependem de US1. Podem ser feitas com seed em vez de US5. Entre si dependem só de `agregacao.ts` e `dashboard.service.ts`, então convém fazê-las em sequência.
- **US10 (Ph 12)** depende de US6. **US11** depende de US5 e US6.
- **US12** depende de US2 e US7. **US13** depende de US4 e US5. **US14** depende de US11 (`/status`).
- **US15** depende de US6–US9. **US16** depende de US3 e US5.
- **Polish** vem depois de todas.

### User Story Dependencies (grafo)
```
Setup → Foundational → US1 → US2 → US3 → US4 → US5 ─┬→ US11 → US14
                         │                          ├→ US13
                         │                          └→ US16
                         └→ US6 → US7 → US8 → US9 → US10
                                   └→ US12           └→ US15
```

### Within Each User Story
Testes (falhando) → domínio puro → adapters/repositórios → services → rotas → UI.

---

## Parallel Example: Setup
```
T002 backend/package.json | T003 frontend Vite | T005 vitest | T006 prisma.config | T007 Dockerfile | T008 compose | T009 .env.example | T010 constituição | T011 CLAUDE.md
```

## Parallel Example: User Story 1
```
Testes juntos:  T026 embed.spec | T027 sessao.spec | T028 sessao.service.spec | T029 preHandler.spec
Depois:         T032 helenaGateway (paralelo a T030/T031)
```

## Parallel Example: User Story 5
```
Testes juntos:  T059 fixtures | T060 janela | T061 normalizacao | T062 erros | T063 sync.service | T064 expiracao
Domínio junto:  T065 janela.ts | T066 erros.ts | T067 status.ts
```

## Parallel Example: User Story 7
```
T085 categorias.spec | T086 cotacao.spec | T087 agregacaoCusto.spec → T088 categorias.ts | T089 cotacao.ts → T090 … T093
```

---

## Implementation Strategy

### MVP First (US1 + US2)
1. Phase 1 (Setup) + Phase 2 (Foundational).
2. US1: embed, sessão via Helena e isolamento.
3. US2: guarda do admin.
4. **PARE E VALIDE**: abrir pelo Chatfast real (cliente e Fasterisk). Esse é o esqueleto seguro em que tudo o mais se apoia.

### Entrega incremental (alinhada às 5 etapas de PR do plan.md)
| PR | Fases | Valor entregue |
|---|---|---|
| 1 | Ph 1–2 | Esqueleto, constituição, `/health` |
| 2 | Ph 3–4 | Acesso seguro (MVP) |
| 3 | Ph 5–6, 14 (US12), 18 (US16) | Admin cadastra clientes, contas e cotação |
| 4 | Ph 7, 15 (US13) | Coleta real e operação das contas |
| 5 | Ph 8–13, 16, 17 | Dashboard completo, sincronização, faixa e exportação |
| — | Ph 19 | Polimento e validação final |

### Regras
- Cada PR: `npm run lint && npm test` verdes. Branch `feat/...` a partir de `main`, commits em português no formato `Área: o que mudou`.
- Rota nova nasce com teste de isolamento (constituição).
- Os ⚠️ do research.md são resolvidos nas tasks T042, T075 e T128, antes de fechar a PR correspondente.
