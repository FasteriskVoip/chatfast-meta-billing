# Research (Fase 0): Consumo Meta

Pesquisa feita em 2026-11-17 na documentação oficial da Meta (Graph API **v27.0**, lançada em 2026-11-04) e da Helena (`helena.readme.io`).

Legenda: ✅ confirmado na documentação · ⚠️ não confirmado (validar com chamada real na etapa indicada).

## Matriz de viabilidade

| Métrica (spec) | Fonte | Granularidade | Atraso | Situação |
|---|---|---|---|---|
| Enviadas por número/dia | `analytics` (`sent`) | HALF_HOUR / DAY / MONTH | ⚠️ não documentado | ✅ v1 |
| Entregues por número/dia | `analytics` (`delivered`) | idem | ⚠️ | ✅ v1 |
| Volume por categoria | `pricing_analytics` (`VOLUME`, dim. `PRICING_CATEGORY`) | HALF_HOUR / DAILY / MONTHLY | ⚠️ | ✅ v1, conta só mensagens **entregues** |
| Custo por categoria | `pricing_analytics` (`COST`) | idem | ⚠️ | ✅ v1, na **moeda da WABA**, aproximado; **ausente em linha de crédito de parceiro** |
| Cobradas × gratuitas | `pricing_analytics` dim. `PRICING_TYPE` | idem | ⚠️ | ✅ v1 |
| Por número | dim. `PHONE` / `analytics.phone_numbers()` | idem | ⚠️ | ✅ v1 |
| Por país / tier | dim. `COUNTRY`, `TIER` | idem | ⚠️ | ✅ coletado, sem tela na v1 |
| Qualidade do número | `GET /{WABA}/phone_numbers` (`quality_rating`) | foto do momento | ao vivo | ✅ v1 |
| Recebidas | webhook `messages`; talvez `analytics` + `product_types(100)` ⚠️ | — | — | ❌ fora da v1 (US-17) |
| `conversation_analytics` | — | — | — | ❌ **indisponível desde 2026-11-01** |
| `template_analytics` | por template, 90 dias, exige opt-in irreversível | DAILY | — | ❌ não usar (não cobre service nem categoria) |

## Decisões

### R-01: Fonte de volume e custo: `pricing_analytics`
- **Decision:** usar `GET /{WABA}?fields=pricing_analytics.start(<unix>).end(<unix>).granularity(DAILY).dimensions(PHONE,PRICING_CATEGORY,PRICING_TYPE,COUNTRY,TIER)`. A resposta é `pricing_analytics.data[].data_points[]`, e cada ponto traz `{start, end, phone_number?, country, pricing_category, pricing_type, tier?, volume, cost}`.
- **Rationale:** é a única fonte de custo por mensagem após a mudança de 2025-07-01. Fonte: https://developers.facebook.com/docs/whatsapp/business-management-api/analytics
- **Alternatives considered:** `conversation_analytics` (descontinuado); estimar por tabela de preço (rejeitado na spec, US-07).
- ⚠️ O nome da chave do número quando há a dimensão `PHONE` (`phone_number` ou `phone`) não está confirmado. O normalizador aceita as duas e é validado com uma fixture real na etapa 4.

### R-02: Categorias da Meta → 4 grupos da tela
A Meta devolve 7 categorias. O banco guarda a **categoria crua** e o domínio agrupa:

| Meta | Grupo na tela |
|---|---|
| `MARKETING`, `MARKETING_LITE` | Marketing |
| `UTILITY` | Utility |
| `AUTHENTICATION`, `AUTHENTICATION_INTERNATIONAL` | Autenticação |
| `SERVICE`, `REFERRAL_CONVERSION` | Serviço |

- `pricing_type`: `REGULAR` = cobrada; `FREE_CUSTOMER_SERVICE` e `FREE_ENTRY_POINT` = gratuita.
- Uma categoria desconhecida (nova na Meta) é gravada como `OUTRA`, logada (sem payload) e somada só no total.
- **Contradiz o prompt original**, que previa 4 categorias.

### R-03: Moeda e cotação
- **Decision:** o custo é gravado **na moeda da WABA**, lida de `GET /{WABA}?fields=currency` no cadastro. A conversão para R$ segue esta regra:
  - `BRL`: sem conversão;
  - `USD`: cotação USD → BRL vigente no dia (FR-022, FR-023);
  - outra moeda: custo em R$ "indisponível", com aviso no admin.
- **Rationale:** a moeda da WABA é definida na criação e não muda (página de pricing). A spec assumia USD (A-02), o que **não é garantido**.
- **Alternatives considered:** cotação por moeda (rejeitado porque é especulativo; as contas da Fasterisk são BRL ou USD).

### R-04: Enviadas e entregues: `analytics`
- **Decision:** usar `GET /{WABA}?fields=analytics.start().end().granularity(DAY).phone_numbers([...])`, com uma chamada por número para ter a quebra (a resposta agrega os números filtrados). A granularidade é `DAY` (diferente do `DAILY` do pricing). Sem `product_types`.
- **Rationale:** é o único endpoint com `sent`. O volume do pricing conta só entregues, por isso a nota "Entregues > enviadas" (EC-04) é esperada.

### R-05: Fuso dos dias
- ⚠️ A documentação não diz se os buckets diários de `pricing_analytics` e `analytics` estão em UTC ou no fuso da WABA.
- **Decision:** ler `timezone_id` da WABA no cadastro. A chave `data` de cada fato é derivada de `start` (unix) convertido para o fuso da conta, com fallback em `America/Fortaleza`.
- Na etapa 4, comparar um pull `DAILY` com a soma de `HALF_HOUR` de uma conta real. Se os buckets forem UTC, coletar `HALF_HOUR` e agregar no fuso da conta (é a mesma chamada, só muda a granularidade).

### R-06: Janela, backfill e atraso
- O histórico de `pricing_analytics` vai até **1 ano** atrás (reduzido de 10 anos em 2025-12-01). `SYNC_DIAS_BACKFILL` vem por padrão com 90 e é limitado a 365.
- O atraso não está documentado e os dados são "aproximados". `SYNC_DIAS_REPROCESSO` vem por padrão com 3, com upsert idempotente.
- Com `SYNC_CRON` de hora em hora, uma conta consome cerca de `1 + N números` chamadas por tick, bem abaixo do limite de **200/h por WABA**.

### R-07: Admin na Helena
- `GET {HELENA}/core/v1/agent/{id}` devolve `PublicAgentDTO`. **Não há `isAdmin`**: existem `profile` (string sem valores documentados), `isOwner` (boolean) e `departments[].isSupervisor`.
- `GET /core/v1/agent` devolve um array simples, sem paginação.
- **Decision:** `ehAdmin = isOwner || profile ∈ {valores de admin}`. Os valores de `profile` são levantados na etapa 2 com uma chamada real à conta da Fasterisk e ficam numa constante no `helena.service`, marcada `ponytail:`.
- O `user_id` da URL é comparado com `id` **ou** `userId` do agente: o doc chama o parâmetro de "ID do usuário", e o FastClinic já faz esse fallback.
- **Alternatives considered:** lista de `user_id` admins em env (rejeitado; o usuário escolheu "admin na Helena").

### R-08: Validação do token Meta
- O `debug_token` exige um app token ou um token do desenvolvedor do app. A Plataforma usa o **próprio token como `access_token`** (auto-inspeção), sem precisar de app Meta próprio. ⚠️ Validar na etapa 3. Se falhar, adicionar `META_APP_ID` e `META_APP_SECRET`.
- Campos usados: `is_valid`, `expires_at` (`0` = não expira ⚠️), `scopes`. Exigir `whatsapp_business_management`. `whatsapp_business_messaging` não é necessário para ler analytics, então só gera aviso.
- O admin vê a recomendação de System User token quando `expires_at > 0`.

### R-09: Rate limit e erros
- O cabeçalho `X-Business-Use-Case-Usage` traz `{ <bizId>: [{call_count, total_cputime, total_time, estimated_time_to_regain_access}] }`, com percentuais (100 = bloqueado).
- **Decision:**
  - acima de 80% em qualquer métrica, pausar 2 s entre chamadas daquela conta;
  - nos códigos **4, 80007, 80008** (ou `estimated_time_to_regain_access > 0`), fazer até 3 tentativas com backoff de 2/4/8 s; depois desistir da conta no tick e marcar `ERRO_SYNC` com "limite da Meta";
  - código **190** (ou `OAuthException` 102/463/467): `TOKEN_INVALIDO`, sem retry.
- Fonte: https://developers.facebook.com/docs/graph-api/overview/rate-limiting

### R-10: Exportação
- **Excel:** `exceljs` no backend, a **única dependência nova** além de `recharts`. Ver Complexity Tracking.
- **PDF:** `window.print()` do próprio dashboard com uma folha `@media print`, que esconde filtros e botões e mostra o cabeçalho do relatório. O usuário escolhe "Salvar como PDF".
  - O PDF é a mesma tela, sem divergência de números e com zero dependências.
  - ⚠️ Risco: se o iframe do Chatfast tiver `sandbox` sem `allow-modals`, `print()` é bloqueado. O plano B, que entra só se o teste na etapa 5 falhar, é gerar o PDF no backend.
- **Alternatives considered:** `jspdf`+`html2canvas` (2 dependências, gráficos rasterizados) e `pdfkit` no servidor (redesenhar gráficos à mão).

### R-11: Mensagens recebidas (US-17, futuro)
- Um segundo app pode se inscrever no WABA (`subscribed_apps` lista vários apps, e os retries vão "para todos os apps inscritos"). O fan-out explícito e o override de callback por app ⚠️ **não estão confirmados**.
- A hipótese mais barata a testar no futuro é `analytics` com `product_types(100)` ("incoming messages").
- Fica fora da v1, conforme a spec.

### R-12: Linha de crédito de parceiro (risco de produto)
A Meta **não devolve custo** para WABAs que compartilham a linha de crédito de um Solution Partner. Se as WABAs dos clientes estiverem na linha de crédito do Chatfast/Fasterisk como BSP, **o custo ficará "indisponível" para todos**, conforme a regra de US-07.
- A conta é marcada `semCustoMeta` quando um pull retorna volume > 0 com `cost` ausente em todos os pontos.
- **Ação:** confirmar com uma WABA real antes da etapa 5.
