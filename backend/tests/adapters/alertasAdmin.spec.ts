import { describe, expect, it } from 'vitest';
import { CID_A, CID_FASTERISK, RepoMemoria } from '../fakes.js';
import { auth, montarApp } from '../app.helper.js';

describe('PATCH /api/admin/clientes/:id com limites de alerta', () => {
  async function montar() {
    const repo = new RepoMemoria();
    const c = repo.addCliente({ companyid: CID_A, alertaDiarioEm: '2026-11-18', alertaMensalEm: '2026-11-01' });
    const { app } = await montarApp({ repo });
    const patch = (payload: object) =>
      app.inject({ method: 'PATCH', url: `/api/admin/clientes/${c.id}`, headers: auth(CID_FASTERISK, true), payload });
    return { app, repo, c, patch };
  }

  it('aceita vírgula, grava, zera o "já enviado" e audita', async () => {
    const { repo, patch } = await montar();
    const r = await patch({ limiteDiarioBrl: '200,50', limiteMensalBrl: 3000 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ limiteDiarioBrl: '200.50', limiteMensalBrl: '3000' });
    expect(repo.clientes[0]).toMatchObject({ alertaDiarioEm: null, alertaMensalEm: null });
    expect(repo.auditoria.at(-1)).toMatchObject({ acao: 'cliente.alertas' });
  });

  it('mudar só o diário não rearma o mensal (o form manda os dois limites)', async () => {
    const { repo, patch } = await montar();
    repo.clientes[0]!.limiteDiarioBrl = '200.00';
    repo.clientes[0]!.limiteMensalBrl = '3000.00';
    await patch({ limiteDiarioBrl: '250,00', limiteMensalBrl: '3000,00' });
    expect(repo.clientes[0]).toMatchObject({ limiteDiarioBrl: '250.00', alertaDiarioEm: null, alertaMensalEm: '2026-11-01' });
  });

  it('null remove o limite', async () => {
    const { repo, patch } = await montar();
    await patch({ limiteDiarioBrl: '200' });
    await patch({ limiteDiarioBrl: null });
    expect(repo.clientes[0]!.limiteDiarioBrl).toBeNull();
  });

  it.each([['-5'], ['0'], ['abc'], ['1.500,00'], ['12.345']])('valor inválido %s → 400', async (v) => {
    const { repo, patch } = await montar();
    const r = await patch({ limiteDiarioBrl: v });
    expect(r.statusCode).toBe(400);
    expect(repo.clientes[0]!.limiteDiarioBrl).toBeNull();
  });

  it('cliente comum não define limites (nem os da própria empresa)', async () => {
    const { app, c } = await montar();
    const r = await app.inject({ method: 'PATCH', url: `/api/admin/clientes/${c.id}`, headers: auth(CID_A), payload: { limiteDiarioBrl: '1' } });
    expect(r.statusCode).toBe(403);
  });
});

describe('flag Cliente Taxi', () => {
  it('cadastro com taxi e edição liga/desliga, com auditoria', async () => {
    const repo = new RepoMemoria();
    const { app } = await montarApp({ repo });
    const novo = await app.inject({
      method: 'POST', url: '/api/admin/clientes', headers: auth(CID_FASTERISK, true),
      payload: { nome: 'Rádio Táxi Central', companyid: CID_A, tokenChatfast: 'token-chatfast-123456', taxi: true },
    });
    expect(novo.statusCode).toBe(201);
    expect(novo.json()).toMatchObject({ taxi: true });
    const id = novo.json<{ id: string }>().id;
    const r = await app.inject({ method: 'PATCH', url: `/api/admin/clientes/${id}`, headers: auth(CID_FASTERISK, true), payload: { taxi: false } });
    expect(r.json()).toMatchObject({ taxi: false });
    expect(repo.auditoria.at(-1)).toMatchObject({ acao: 'cliente.editar', dados: { taxi: false } });
  });

  it('cadastro sem a flag: não é Taxi', async () => {
    const { app } = await montarApp();
    const r = await app.inject({
      method: 'POST', url: '/api/admin/clientes', headers: auth(CID_FASTERISK, true),
      payload: { nome: 'Loja', companyid: CID_A, tokenChatfast: 'token-chatfast-123456' },
    });
    expect(r.json()).toMatchObject({ taxi: false });
  });
});
