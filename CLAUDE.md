# Consumo Meta

Dashboard multi-tenant do consumo da WhatsApp Cloud API, embutido no Chatfast. A spec e o plano ficam em `specs/001-consumo-meta/`, e as regras invioláveis em `.specify/memory/constitution.md`.

## Comandos
- `npm run dev:full`: back (:3002) + front (:5173)
- `npm run lint`: tsc do back, do front e dos testes
- `npm test`: Vitest (sem banco nem HTTP reais)
- `npx prisma migrate dev --name <nome>`: nova migration
- `docker compose up -d db`: Postgres de dev

## Mapa
- `backend/server/domain/`: regra pura (consumo, sync, ports)
- `backend/server/services/`: orquestração
- `backend/server/adapters/`: http (rotas finas, embed, sessão), prisma, meta (único ponto que fala com graph.facebook.com), helena, cripto
- `frontend/src/lib/api.ts`: único acesso à API
- `frontend/src/features/{dashboard,admin}`: as telas

## Regras-chave
- O domínio não importa adapters. O JSON da Meta e da Helena é normalizado no gateway.
- Toda query filtra por `companyid`. Rota nova nasce com teste de isolamento.
- Tokens são cifrados (AES-GCM), nunca voltam ao front e nunca vão para log.
- Custo ausente ≠ 0. Mostrar "—" ou "indisponível".
- Imports ESM relativos com sufixo `.js`. Logger pino, sem `console.*`.
- Atalho consciente leva um comentário `ponytail:`.
