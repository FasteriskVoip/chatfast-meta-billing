# Data Model: Consumo Meta

PostgreSQL 16 via Prisma Migrate. Tabelas e colunas em `snake_case` (`@@map`/`@map`), modelos em `camelCase` no TS. Ids `uuid` (`gen_random_uuid()`), timestamps `timestamptz`. Toda tabela de negócio tem `companyid`, e toda query filtra por ele.

## Enums

| Enum | Valores |
|---|---|
| `StatusCliente` | `ATIVO`, `INATIVO` |
| `StatusConta` | `ATIVA`, `TOKEN_INVALIDO`, `TOKEN_EXPIRANDO`, `ERRO_SYNC`, `PAUSADA` |
| `CategoriaMeta` | `MARKETING`, `MARKETING_LITE`, `UTILITY`, `AUTHENTICATION`, `AUTHENTICATION_INTERNATIONAL`, `SERVICE`, `REFERRAL_CONVERSION`, `OUTRA` (crua, ver research R-02) |
| `TipoPreco` | `REGULAR`, `FREE_CUSTOMER_SERVICE`, `FREE_ENTRY_POINT`, `OUTRO` |
| `QualidadeNumero` | `GREEN`, `YELLOW`, `RED`, `UNKNOWN` |
| `OrigemSync` | `CICLO`, `ADMIN`, `CLIENTE` |
| `StatusExecucao` | `EXECUTANDO`, `OK`, `ERRO`, `IGNORADA` |

O agrupamento em 4 categorias de tela (Marketing, Utility, Autenticação, Serviço) e a regra cobrada/gratuita ficam em `domain/consumo`, não no banco.

## Entidades

### `cliente`
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| companyid | uuid **unique** | `company_id` do Chatfast |
| nome | text | obrigatório, 1–120 |
| token_chatfast_cifrado | text | AES-256-GCM (`iv.tag.cifra` em base64) |
| token_chatfast_ultimos4 | char(4) | exibição |
| status | `StatusCliente` | padrão `ATIVO` |
| inativo_desde | date null | usado no reprocessamento ao reativar (FR-052) |
| criado_em / atualizado_em | timestamptz | |

### `conta_waba`
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| cliente_id | uuid FK → cliente | |
| companyid | uuid | igual ao do cliente (desnormalizado para filtro direto) |
| waba_id | text **unique** | não pode estar em dois clientes (FR-015) |
| nome | text | padrão: o `name` da WABA na Meta |
| token_cifrado / token_ultimos4 | text / char(4) | |
| token_expira_em | timestamptz null | null = não expira |
| moeda | char(3) | `currency` da WABA (research R-03) |
| fuso | text | `timezone_id` da WABA → IANA; padrão `America/Fortaleza` |
| status | `StatusConta` | padrão `ATIVA` |
| sem_custo_meta | boolean | padrão false (R-12) |
| historico_desde | date null | primeiro dia já coletado; null = backfill pendente |
| ultimo_sync_em | timestamptz null | último sync **com sucesso** |
| ultimo_erro | text null | mensagem curta, sem payload nem token |
| desatualizado_desde | timestamptz null | entrou num status de problema (faixa amarela, US-14) |
| sync_em_andamento_desde | timestamptz null | lock (ver abaixo) |
| criado_em / atualizado_em | timestamptz | |

**Transições de status**
```
ATIVA ──erro 190──────────► TOKEN_INVALIDO ──troca de token válido──► ATIVA
ATIVA ──expira ≤ 7 d──────► TOKEN_EXPIRANDO ──troca de token──────────► ATIVA
ATIVA/TOKEN_EXPIRANDO ──falha (rede/limite)──► ERRO_SYNC ──próximo sync OK──► ATIVA
qualquer ──pausar──► PAUSADA ──retomar──► ATIVA (e revalida o token no próximo sync)
```
- Coletáveis: `ATIVA`, `TOKEN_EXPIRANDO` e `ERRO_SYNC`, de clientes `ATIVO`.
- `desatualizado_desde` é preenchido ao entrar em `TOKEN_INVALIDO`, `ERRO_SYNC` ou `PAUSADA`, e zerado no próximo sync OK.

**Lock:**
```sql
UPDATE conta_waba
SET sync_em_andamento_desde = now()
WHERE id = $1
  AND (sync_em_andamento_desde IS NULL OR sync_em_andamento_desde < now() - interval '30 minutes')
```
1 linha afetada = lock obtido. A liberação é feita no `finally`.

**Intervalo do cliente (FR-047):** `disponivelEm = ultimo_sync_em + 15 min`, sem coluna extra.

### `numero`
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| conta_waba_id | uuid FK | |
| companyid | uuid | |
| phone_number_id | text **unique** | id do número na Meta |
| display_phone_number | text | `+55 61 3399-3888` |
| verified_name | text null | |
| qualidade | `QualidadeNumero` | `NA`/ausente → `UNKNOWN` |
| coleta_ativa | boolean | padrão true |
| nao_encontrado_na_meta | boolean | padrão false (EC-17) |
| criado_em / atualizado_em | timestamptz | |

Números novos que aparecem na Meta durante o sync são criados automaticamente. Os removidos não são apagados (ficam com `nao_encontrado_na_meta=true`).

### `consumo_diario` (fato de volume e custo, origem `pricing_analytics`)
| Coluna | Tipo | Regra |
|---|---|---|
| id | bigserial PK | |
| companyid | uuid | |
| conta_waba_id | uuid FK | |
| numero_id | uuid FK | |
| data | date | no fuso da conta |
| categoria | `CategoriaMeta` | crua |
| tipo_preco | `TipoPreco` | |
| pais | char(2) | `''` quando ausente (evita NULL na chave unique) |
| tier | text | `''` quando ausente |
| volume | integer ≥ 0 | |
| custo | numeric(14,6) **null** | null = a Meta não informou. **Nunca** converter em 0 |
| moeda | char(3) | |
| atualizado_em | timestamptz | |

- **Unique:** `(numero_id, data, categoria, tipo_preco, pais, tier)`, com upsert `ON CONFLICT DO UPDATE`.
- **Índice:** `(companyid, data)`.

### `mensagens_diarias` (fato de envio, origem `analytics`)
| Coluna | Tipo | Regra |
|---|---|---|
| id | bigserial PK | |
| companyid | uuid | |
| conta_waba_id | uuid FK | |
| numero_id | uuid FK | |
| data | date | |
| enviadas | integer ≥ 0 | |
| entregues | integer ≥ 0 | |
| atualizado_em | timestamptz | |

- **Unique:** `(numero_id, data)`, com upsert.
- **Índice:** `(companyid, data)`.

### `cotacao` (global, sem `companyid`: é configuração da Fasterisk)
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| valor | numeric(10,4) | > 0 (USD → BRL) |
| vigente_desde | date **unique** | uma nova cotação na mesma data substitui a anterior |
| criado_por | text | `user_id` da sessão |
| criado_em | timestamptz | |

**Regra de conversão (domínio):**
- cotação do dia D = a de maior `vigente_desde ≤ D`;
- se não houver nenhuma assim, usa a de **menor** `vigente_desde` e marca `convertidoComCotacaoPosterior`;
- tabela vazia: `sem_cotacao`.

### `execucao_sync`
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| companyid | uuid |
| conta_waba_id | uuid FK |
| origem | `OrigemSync` |
| status | `StatusExecucao` |
| inicio / fim | timestamptz / timestamptz null |
| janela_de / janela_ate | date |
| linhas | integer |
| erro | text null |

Índice `(conta_waba_id, inicio desc)`.

### `auditoria`
| Coluna | Tipo |
|---|---|
| id | bigserial PK |
| companyid | uuid (empresa afetada) |
| user_id | text (autor, da sessão) |
| acao | text (`cliente.criar`, `conta.trocar_token`, `cotacao.criar`…) |
| entidade / entidade_id | text |
| dados | jsonb (**sem segredos**; o token vira `{ultimos4}`) |
| criado_em | timestamptz |

Índice `(companyid, criado_em desc)`.

## Relacionamentos
```
cliente 1─N conta_waba 1─N numero 1─N consumo_diario
                       │           └─N mensagens_diarias
                       └─N execucao_sync
cotacao (global)   auditoria (por companyid)
```

## Agregações do dashboard (`$queryRaw` só aqui)
1. `consumo_diario` agrupado por `(data, numero_id, categoria, tipo_preco, moeda)`, com:
   - `sum(volume)`;
   - `sum(custo)`;
   - `count(*) filter (where custo is null)` (detecta custo parcial).

   O domínio converte com a cotação do dia, agrupa as categorias e calcula %, cobradas/gratuitas e totais.
2. `mensagens_diarias` agrupado por `(data, numero_id)`.

A escala é de dezenas de clientes × 90 dias × poucos números × 7 categorias, ou seja, alguns milhares de linhas por chamada. A conversão em memória é suficiente.
