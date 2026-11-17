# Contrato HTTP: Consumo Meta

Base: mesma origem do front (`/api`). Formato JSON. Datas `YYYY-MM-DD` no fuso da conta, timestamps ISO-8601 UTC.

**Convenções**
- Sucesso devolve o objeto direto, sem envelope.
- Erro devolve `{ "error": string, "codigo"?: string }` com o status HTTP correto. Em 5xx inclui `traceId`.
- Toda rota `/api/*` exige `Authorization: Bearer <sessão>`, exceto `POST /api/sessao` e `GET /health`.
- Todo recurso por id (`:clienteId`, `:contaId`, `:numeroId`) é conferido contra o `cid` da sessão. Rotas `/api/admin/*` exigem `admin=true` e operam sobre qualquer cliente.
- Valores monetários vêm como **string decimal** (`"12.345600"`) ou `null` (custo ausente ≠ 0).

## Códigos de erro

| HTTP | `codigo` | Quando |
|---|---|---|
| 400 | `VALIDACAO` | corpo/query inválido (zod); `error` traz o campo |
| 401 | `SEM_USUARIO` | `companyid`/`user_id` ausente ou com formato inválido |
| 401 | `SESSAO_INVALIDA` | Bearer ausente, adulterado ou vencido |
| 403 | `AGENTE_DESCONHECIDO` | Helena não reconhece o agente na empresa |
| 403 | `SEM_PERMISSAO_ADMIN` | rota admin sem `admin` |
| 403 | `FORA_DA_EMPRESA` | recurso ou `companyid` de outra empresa |
| 403 | `CLIENTE_INATIVO` | cliente desativado |
| 404 | `SEM_CADASTRO` | `companyid` não cadastrado |
| 404 | `NAO_ENCONTRADO` | recurso inexistente |
| 409 | `DUPLICADO` | `companyid` ou `wabaId` já cadastrado |
| 409 | `SYNC_EM_ANDAMENTO` | já existe coleta rodando na conta |
| 409 | `SYNC_INDISPONIVEL` | cliente sem conta coletável (todas pausadas ou com token inválido) |
| 422 | `TOKEN_META_INVALIDO` | `debug_token` inválido/expirado/sem escopo (detalhe em `error`) |
| 429 | `SYNC_AGUARDE` | cliente tentou sincronizar antes de 15 min; inclui `disponivelEm` |
| 502 | `HELENA_RECUSOU_TOKEN` | token Chatfast do cliente recusado (401/403 da Helena) |
| 503 | `HELENA_INDISPONIVEL` | Helena fora do ar ou timeout (5 s) |
| 503 | `META_INDISPONIVEL` | Meta fora do ar ou limite atingido durante cadastro/validação |

---

## Infra

### `GET /health`
`200 { "ok": true }`. Não toca a Meta. Confere o banco com `SELECT 1`.

## Sessão

### `POST /api/sessao`
```json
{ "companyid": "uuid", "user_id": "uuid" }
```
`200`:
```json
{ "token": "string", "expiraEm": "ISO", "nome": "string", "admin": false, "empresa": { "nome": "string" } }
```
Erros: `SEM_USUARIO`, `SEM_CADASTRO`, `CLIENTE_INATIVO`, `AGENTE_DESCONHECIDO`, `HELENA_RECUSOU_TOKEN`, `HELENA_INDISPONIVEL`.

`admin = companyid ∈ ADMIN_COMPANYIDS && agenteEhAdminNaHelena`. A regra de "admin na Helena" está em research.md (R-07).

---

## Dashboard (cliente; o admin pode passar `companyid` para ver qualquer cliente; no front, `/dashboard?...&ver=<companyid>`)

Filtros comuns (query): `de`, `ate` (obrigatórios, `de ≤ ate`, no máximo 366 dias), `contaId?`, `numeroId?`, `categoria?` (`MARKETING|UTILITY|AUTHENTICATION|SERVICE`).

### `GET /api/dashboard/filtros`
```json
{
  "contas": [{ "id": "uuid", "nome": "string", "wabaId": "string" }],
  "numeros": [{ "id": "uuid", "contaId": "uuid", "display": "+55 61 ...", "nomeVerificado": "string" }],
  "categorias": ["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"],
  "historicoDesde": "YYYY-MM-DD | null",
  "fuso": "America/Fortaleza"
}
```

### `GET /api/dashboard/status`
Leve, usado no polling durante a sincronização e para a faixa amarela.
```json
{
  "ultimoSync": "ISO | null",
  "sincronizando": false,
  "sincronizarDisponivelEm": "ISO | null",
  "desatualizadoDesde": "YYYY-MM-DD | null",
  "coletandoHistorico": false
}
```

### `GET /api/dashboard/resumo?<filtros>`
Uma chamada recalcula a tela inteira.
```json
{
  "periodo": { "de": "YYYY-MM-DD", "ate": "YYYY-MM-DD", "incluiHoje": true },
  "envio": {
    "enviadas": 35676, "entregues": 35612, "naoEntregues": 64,
    "taxaEntrega": 0.998,
    "mediaDiaria": 2099, "diasComEnvio": 16, "diasNoPeriodo": 17,
    "pico": { "data": "YYYY-MM-DD", "enviadas": 6629 }
  },
  "categorias": [
    {
      "categoria": "MARKETING", "volume": 16027, "percentual": 0.45,
      "cobradas": 16027, "gratuitas": 0,
      "custoBrl": "5008.470000",
      "custoSituacao": "completo | parcial | indisponivel | sem_cotacao"
    }
  ],
  "total": {
    "volume": 35612, "categorias": 4, "cobradas": 30271,
    "custoBrl": "5559.250000", "custoMedioPorCobradaBrl": "0.183650",
    "custoSituacao": "completo | parcial | indisponivel | sem_cotacao",
    "diasSemCusto": 0, "convertidoComCotacaoPosterior": false
  },
  "serieCategorias": [
    { "data": "YYYY-MM-DD", "MARKETING": { "volume": 0, "custoBrl": "0.000000" }, "UTILITY": {}, "AUTHENTICATION": {}, "SERVICE": {} }
  ],
  "serieMensagens": [{ "data": "YYYY-MM-DD", "enviadas": 0, "entregues": 0 }],
  "porNumero": [
    {
      "numeroId": "uuid", "conta": "string", "display": "string", "nomeVerificado": "string",
      "qualidade": "GREEN | YELLOW | RED | UNKNOWN",
      "enviadas": 0, "entregues": 0, "taxaEntrega": 0.998,
      "porCategoria": { "MARKETING": 0, "UTILITY": 0, "AUTHENTICATION": 0, "SERVICE": 0 },
      "custoBrl": "string | null", "percentualDoTotal": 0.769
    }
  ],
  "ultimoSync": "ISO | null"
}
```
- As séries trazem **todos os dias** do período, inclusive os zerados.
- `taxaEntrega` é `null` quando `enviadas = 0`.
- `custoSituacao` aplica as regras de FR-023, FR-024 e FR-039.

### `POST /api/dashboard/sincronizar`
Dispara a coleta das contas coletáveis do cliente, sem esperar o fim.
- `202 { "iniciado": true }`.
- Erros: `429 SYNC_AGUARDE { disponivelEm }` e `409 SYNC_EM_ANDAMENTO`.
- O front faz polling em `/status` a cada 3 s até `sincronizando=false`.

### `GET /api/dashboard/exportar.xlsx?<filtros>`
`200` com `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e `Content-Disposition: attachment; filename="consumo-<empresa>-<de>-<ate>.xlsx"`.
- Abas: **Resumo**, **Por número** e **Diário**.
- Colunas da aba Diário: data, conta, número, categoria, categoria_meta, tipo_preco, volume, cobradas, gratuitas, custo_moeda_conta, moeda, cotacao, custo_brl, situacao.

O PDF **não** tem endpoint: é a impressão do próprio dashboard com folha de estilo de impressão (research.md R-10).

---

## Admin (`admin=true`)

### `GET /api/admin/painel`
```json
{
  "contasComProblema": 2,
  "cotacaoVigente": { "valor": "5.4300", "vigenteDesde": "YYYY-MM-DD" },
  "semCotacao": false
}
```

### `GET /api/admin/clientes`
```json
[{
  "id": "uuid", "nome": "string", "companyid": "uuid", "status": "ATIVO | INATIVO",
  "contas": 2, "piorStatus": "ATIVA | TOKEN_EXPIRANDO | ERRO_SYNC | TOKEN_INVALIDO | PAUSADA | null",
  "ultimoSync": "ISO | null", "alerta": true, "alertaChatfast": false
}]
```

### `POST /api/admin/clientes`
Body `{ "nome", "companyid", "tokenChatfast" }`, que valida o token com uma chamada à Helena.
- `201` com o cliente, contendo `tokenChatfastUltimos4` e nunca o token.
- Erros: `409 DUPLICADO` e `422 VALIDACAO`.

### `GET /api/admin/clientes/:clienteId`
Devolve o cliente e suas contas. Cada conta traz:
- `id`, `wabaId`, `nome`, `status`, `tokenUltimos4`, `tokenExpiraEm`, `ultimoSync`, `ultimoErro`, `semCustoMeta`;
- os números (`id`, `display`, `nomeVerificado`, `qualidade`, `coletaAtiva`, `naoEncontradoNaMeta`).

### `PATCH /api/admin/clientes/:clienteId`
Body parcial `{ "nome"?, "tokenChatfast"?, "status"?: "ATIVO|INATIVO" }`. Reativar dispara o reprocessamento (FR-052).

### `POST /api/admin/clientes/:clienteId/contas`
Body `{ "wabaId", "token", "nome"? }`. Executa `debug_token`, `GET /{waba}` e `/phone_numbers`, e então agenda o backfill.
- `201` com a conta e os números.
- Erros: `422 TOKEN_META_INVALIDO` e `409 DUPLICADO`.

### `PATCH /api/admin/contas/:contaId`
Body `{ "token"? , "pausada"?: boolean, "nome"? }`. Trocar o token revalida e volta a conta para `ATIVA`.

### `POST /api/admin/contas/:contaId/testar`
`200 { "ok": true, "tokenExpiraEm": "ISO|null", "escopos": [], "problema"?: "string" }`. Não coleta dados.

### `POST /api/admin/contas/:contaId/sincronizar`
`202`, ou `409 SYNC_EM_ANDAMENTO`. Sem o intervalo de 15 min.

### `POST /api/admin/contas/:contaId/atualizar-numeros`
`200` com a lista de números atualizada.

### `GET /api/admin/contas/:contaId/execucoes?limite=20`
```json
[{ "id": "uuid", "origem": "CICLO|ADMIN|CLIENTE", "inicio": "ISO", "fim": "ISO|null", "status": "OK|ERRO|IGNORADA", "janelaDe": "YYYY-MM-DD", "janelaAte": "YYYY-MM-DD", "linhas": 0, "erro": "string|null" }]
```

### `PATCH /api/admin/numeros/:numeroId`
Body `{ "coletaAtiva": boolean }`.

### `GET /api/admin/cotacoes`
`[{ "id", "valor": "5.4300", "vigenteDesde": "YYYY-MM-DD", "criadoPor", "criadoEm" }]`, ordenado da mais nova para a mais antiga.

### `POST /api/admin/cotacoes`
Body `{ "valor": "5.43", "vigenteDesde": "YYYY-MM-DD" }`. Valor > 0 com até 4 casas. Uma vigência já existente na mesma data é **substituída** e auditada.

---

## Webhook Meta
Não existe na v1 (US-17 fora do escopo).
