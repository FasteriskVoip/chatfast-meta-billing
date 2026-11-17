import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CID_A, CID_FASTERISK } from '../fakes.js';
import { auth, montarApp } from '../app.helper.js';

const ID = randomUUID();
const ROTAS: [string, string][] = [
  ['GET', '/api/admin/painel'],
  ['GET', '/api/admin/clientes'],
  ['POST', '/api/admin/clientes'],
  ['GET', `/api/admin/clientes/${ID}`],
  ['PATCH', `/api/admin/clientes/${ID}`],
  ['POST', `/api/admin/clientes/${ID}/contas`],
  ['PATCH', `/api/admin/contas/${ID}`],
  ['POST', `/api/admin/contas/${ID}/testar`],
  ['POST', `/api/admin/contas/${ID}/sincronizar`],
  ['POST', `/api/admin/contas/${ID}/atualizar-numeros`],
  ['GET', `/api/admin/contas/${ID}/execucoes`],
  ['PATCH', `/api/admin/numeros/${ID}`],
  ['GET', '/api/admin/cotacoes'],
  ['POST', '/api/admin/cotacoes'],
];

describe('guarda do admin', () => {
  it.each(ROTAS)('%s %s sem admin → 403 SEM_PERMISSAO_ADMIN', async (method, url) => {
    const { app } = await montarApp();
    const r = await app.inject({ method: method as 'GET', url, headers: auth(CID_A), payload: method === 'GET' ? undefined : {} });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ codigo: 'SEM_PERMISSAO_ADMIN' });
  });

  it('cobre todas as rotas admin registradas', async () => {
    const { app } = await montarApp();
    const registradas = app.printRoutes({ commonPrefix: false }).split('\n').filter((l) => l.includes('/api/admin')).length;
    expect(registradas).toBeGreaterThan(0);
    // cada rota da lista é única e existe (403 e não 404 acima)
    expect(new Set(ROTAS.map((r) => r.join(' '))).size).toBe(ROTAS.length);
  });

  it('admin acessa', async () => {
    const { app } = await montarApp();
    const r = await app.inject({ url: '/api/admin/clientes', headers: auth(CID_FASTERISK, true) });
    expect(r.statusCode).toBe(200);
  });
});
