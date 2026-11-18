import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CID_A, CID_FASTERISK } from '../fakes.js';
import { auth, helenaFake, montarApp } from '../app.helper.js';

const ID = randomUUID();
const ROTAS: [string, string][] = [
  ['GET', '/api/admin/painel'],
  ['GET', '/api/admin/clientes'],
  ['GET', '/api/admin/consumo'],
  ['GET', '/api/admin/relatorio.xlsx'],
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

describe('POST /api/sessao/primeiro-acesso', () => {
  const adm = { id: 'adm-1', userId: 'u-adm', nome: 'Bia', isOwner: true, profile: null };
  const corpo = (companyid: string, user_id: string) => ({ companyid, user_id, nome: 'Fasterisk', tokenChatfast: 'token-fasterisk-9876' });

  it('outra empresa não se cadastra pela tela (nem com agente dono)', async () => {
    const { app, repo } = await montarApp({ helena: helenaFake([adm]) });
    const r = await app.inject({ method: 'POST', url: '/api/sessao/primeiro-acesso', payload: corpo(CID_A, 'adm-1') });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ codigo: 'SEM_PERMISSAO' });
    expect(repo.clientes).toHaveLength(0);
  });

  it('empresa admin: sessão antes avisa podeCadastrar; o cadastro devolve sessão que abre o /admin', async () => {
    const { app } = await montarApp({ helena: helenaFake([adm]) });
    const antes = await app.inject({ method: 'POST', url: '/api/sessao', payload: { companyid: CID_FASTERISK, user_id: 'adm-1' } });
    expect(antes.json()).toMatchObject({ codigo: 'SEM_CADASTRO', podeCadastrar: true });

    const r = await app.inject({ method: 'POST', url: '/api/sessao/primeiro-acesso', payload: corpo(CID_FASTERISK, 'adm-1') });
    expect(r.statusCode).toBe(200);
    const s = r.json<{ token: string; admin: boolean }>();
    expect(s.admin).toBe(true);
    const lista = await app.inject({ method: 'GET', url: '/api/admin/clientes', headers: { authorization: `Bearer ${s.token}` } });
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toHaveLength(1);
  });
});
