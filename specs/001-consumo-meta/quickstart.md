# Quickstart: validação da feature Consumo Meta

Roteiro para provar, de ponta a ponta, que a feature funciona. Contratos em [contracts/api.md](contracts/api.md), modelo em [data-model.md](data-model.md).

## Pré-requisitos
- Node 22, Docker (para o Postgres 16).
- `backend/.env` a partir de `backend/.env.example`, com:
  - `CHAVE_CRIPTOGRAFIA`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  - `SEGREDO_SESSAO` com 32 caracteres ou mais
  - `ADMIN_COMPANYIDS` = companyid da Fasterisk
  - `HELENA_API_URL=https://api.helena.run`
  - `META_GRAPH_VERSION=v27.0`
  - `EXIGIR_EMBED=false` e `EXIGIR_SESSAO=true`, para testar fora do iframe
- Para validação real: um token Chatfast da Fasterisk, uma WABA de teste e um System User token com `whatsapp_business_management`.

## 1. Subir e testar
```bash
npm ci
docker compose up -d db
npx prisma migrate deploy
npm run lint && npm test        # esperado: tudo verde
npm run dev:full                # back :3002, front :5173
curl localhost:3002/health      # {"ok":true}
```

## 2. Cenários automatizados (o `npm test` deve cobrir)
| Spec | Arquivo de teste | Prova |
|---|---|---|
| US-01/02, FR-005/006 | `adapters/sessao.spec`, `adapters/isolamento.spec` | sessão adulterada ou vencida → 401; empresa A não lê B em **nenhuma** rota do dashboard nem no export; rota admin sem `admin` → 403 |
| US-01 EC-05/06 | `services/sessao.service.spec` | Helena com timeout → 503 `HELENA_INDISPONIVEL`; Helena 401 → 502 `HELENA_RECUSOU_TOKEN` |
| FR-007 | `adapters/embed.spec` | `Sec-Fetch-Dest: document` → 403; CSP `frame-ancestors` presente |
| FR-009 | `adapters/aesGcm.spec` | ida e volta OK; cifra adulterada ou chave errada → erro |
| US-05 | `domain/sync/*.spec` | janela de backfill (limite de 365 d) e reprocesso; normalização da fixture real de `pricing_analytics`/`analytics`; erro 190 → `TOKEN_INVALIDO`; 80008 → backoff → `ERRO_SYNC` |
| FR-028 | `services/sync.service.spec` | dois syncs iguais → mesmos totais |
| FR-029 | `services/sync.service.spec` | lock ocupado → execução `IGNORADA` |
| US-06/07, FR-022/023/039 | `domain/consumo/*.spec` | presets no fuso (borda de meia-noite); %; custo null ≠ 0; parcial; cotação por dia e cotação posterior; `sem_cotacao`; agrupamento das 7 categorias em 4 |
| FR-047 | `services/dashboard.service.spec` | sincronizar antes de 15 min → 429 com `disponivelEm` |

## 3. Validação manual com dados reais (etapas 2 a 5)
1. **Sessão:** `POST /api/sessao` com o companyid da Fasterisk e um agente admin.
   - Esperado: `admin:true`.
   - Repetir com um agente comum: `admin:false`. Registrar os valores de `profile` vistos (research R-07).
2. **Cliente:** criar o cliente pelo `/admin`.
   - O detalhe mostra só os 4 últimos dígitos do token.
   - Abrir `/dashboard?company_id=<cliente>&user_id=<agente do cliente>`: estado "Coletando histórico".
3. **Conta WABA:** cadastrar a conta.
   - Esperado: números listados com qualidade, `moeda` e `fuso` preenchidos, e execução `ADMIN` com status `OK` em "Execuções".
   - Conferir R-05 (fuso dos buckets) e R-08 (`debug_token` por auto-inspeção).
4. **Conformidade (SC-06):** comparar o volume e o custo de um dia no dashboard com o Gerenciador do WhatsApp da Meta. Os valores devem ser iguais na moeda da WABA.
5. **Linha de crédito (R-12):** se o custo vier ausente, a conta deve aparecer como "sem custo da Meta" e o dashboard deve mostrar "—", nunca R$ 0,00.
6. **Cotação:** cadastrar uma cotação com vigência hoje e outra com vigência há 10 dias.
   - Esperado: os dias antigos usam a cotação mais antiga, marcada "convertido com cotação posterior".
7. **Sincronizar (cliente):** clicar em "Sincronizar com a Meta".
   - Esperado: "Sincronizando…" e, ao terminar, o botão fica com "Disponível em 15 min".
8. **Token inválido:** trocar o token por um revogado e sincronizar.
   - Esperado: o admin mostra `TOKEN_INVALIDO` e o contador de problemas, e o cliente vê a faixa amarela.
9. **Exportação:** o Excel abre com 3 abas e os totais batem com a tela. "Exportar PDF" abre a impressão já no layout de relatório **dentro do iframe do Chatfast** (R-10).
10. **Embed:** em produção, abrir a URL direto no navegador. Esperado: 403.

## 3.1 Desempenho medido (2026-11-17, Postgres 16 local)
Medição com 90 dias × 20 números × 7 categorias × 2 tipos de preço (25.200 linhas em `consumo_diario`) e `mensagens_diarias` completo:
- `GET /api/dashboard/resumo` de 90 dias: **~0,43 s** (meta SC-04 ≤ 2 s).
- `GET /api/dashboard/exportar.xlsx` de 90 dias: **~2,3 s**, 1,5 MB (meta SC-12 ≤ 10 s).

## 4. Pronto quando
Todos os itens acima passarem, `npm run lint && npm test` estiver verde e os ⚠️ do research.md (R-01, R-05, R-07, R-08, R-10, R-12) estiverem confirmados ou ajustados.
