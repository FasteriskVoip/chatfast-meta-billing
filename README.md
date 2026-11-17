# Consumo Meta

Monitoramento do consumo da WhatsApp Cloud API (Meta) por cliente, embutido no Chatfast.

- **Coleta:** o backend coleta `pricing_analytics` e `analytics` da Graph API periodicamente e grava no Postgres.
- **Dashboard:** cada cliente vê só o próprio dashboard, e ele lê apenas o banco.
- **Admin:** a Fasterisk administra pelo `/admin`.

## Desenvolvimento
```bash
cp backend/.env.example backend/.env   # preencha CHAVE_CRIPTOGRAFIA, ADMIN_COMPANYIDS, SEGREDO_SESSAO
npm ci
docker compose up -d db
npx prisma migrate deploy
npm run dev:full                       # http://localhost:5173/dashboard?company_id=<uuid>&user_id=<uuid>
```
Para subir tudo no Docker: `docker compose up` (a primeira subida instala as dependências no container e leva alguns minutos). Depois acesse:
- Dashboard: http://localhost:5173/dashboard
- Admin: http://localhost:5173/admin

Em dev (`EXIGIR_SESSAO` vazio e `NODE_ENV` diferente de production), a sessão é de **admin sem validar na Helena**, para testar localmente. Em produção, o acesso exige a validação real do agente.

Portas ocupadas? Use `BACKEND_PORT=3010 FRONTEND_PORT=5180 docker compose up`.

## Produção (Coolify)
O `Dockerfile` gera 1 container que roda `prisma migrate deploy` e depois `npm start`, servindo `/api` e o front na mesma origem, com healthcheck em `/health`.

Configure as variáveis de `backend/.env.example` no Coolify, com `NODE_ENV=production`.

## Qualidade
`npm run lint && npm test` antes de cada PR. Para os detalhes, veja `specs/001-consumo-meta/quickstart.md`.
