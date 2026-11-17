import { describe, expect, it } from 'vitest';
import { CID_A, CID_B, RepoMemoria } from '../fakes.js';
import { auth, montarApp } from '../app.helper.js';

function cenario() {
  const repo = new RepoMemoria();
  const a = repo.addCliente({ companyid: CID_A });
  const b = repo.addCliente({ companyid: CID_B, nome: 'Outra' });
  const contaB = repo.addConta(b);
  const numeroB = repo.addNumero(contaB);
  repo.addConta(a);
  return { repo, contaB, numeroB };
}

const filtros = 'de=2026-11-01&ate=2026-11-17';

describe('preHandler de /api', () => {
  it('sem Bearer → 401 SESSAO_INVALIDA', async () => {
    const { app } = await montarApp({ repo: cenario().repo });
    const r = await app.inject({ url: `/api/dashboard/resumo?${filtros}` });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject({ codigo: 'SESSAO_INVALIDA' });
  });

  it('Bearer adulterado → 401', async () => {
    const { app } = await montarApp({ repo: cenario().repo });
    const r = await app.inject({ url: `/api/dashboard/filtros`, headers: { authorization: 'Bearer abc.def' } });
    expect(r.statusCode).toBe(401);
  });

  it('companyid de outra empresa na query → 403 FORA_DA_EMPRESA', async () => {
    const { app } = await montarApp({ repo: cenario().repo });
    const r = await app.inject({ url: `/api/dashboard/resumo?${filtros}&companyid=${CID_B}`, headers: auth(CID_A) });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ codigo: 'FORA_DA_EMPRESA' });
  });

  it('contaId/numeroId de outra empresa → 403 FORA_DA_EMPRESA', async () => {
    const { repo, contaB, numeroB } = cenario();
    const { app } = await montarApp({ repo });
    for (const q of [`contaId=${contaB.id}`, `numeroId=${numeroB.id}`]) {
      const r = await app.inject({ url: `/api/dashboard/resumo?${filtros}&${q}`, headers: auth(CID_A) });
      expect(r.statusCode).toBe(403);
    }
  });

  it('POST /api/sessao é exceção (não exige Bearer)', async () => {
    const { app } = await montarApp({ repo: cenario().repo });
    const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: {} });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject({ codigo: 'SEM_USUARIO' });
  });

  it('EXIGIR_SESSAO=false libera (dev)', async () => {
    const { app } = await montarApp({ repo: cenario().repo, exigirSessao: false });
    const r = await app.inject({ url: `/api/dashboard/filtros?companyid=${CID_A}` });
    expect(r.statusCode).toBe(200);
  });

  it('sessão de dev (admin sem Helena) só existe com EXIGIR_SESSAO=false', async () => {
    const dev = await montarApp({ repo: cenario().repo, exigirSessao: false });
    const r = await dev.app.inject({ method: 'POST', url: '/api/sessao', payload: { companyid: CID_A } });
    expect(r.json()).toMatchObject({ admin: true });
    const prod = await montarApp({ repo: cenario().repo });
    const p = await prod.app.inject({ method: 'POST', url: '/api/sessao', payload: { companyid: CID_A, user_id: 'x' } });
    expect(p.statusCode).toBe(403);
    expect(p.json()).toMatchObject({ codigo: 'AGENTE_DESCONHECIDO' });
  });

  it('5xx traz traceId', async () => {
    const { app, repo } = await montarApp({ repo: cenario().repo });
    repo.contasDaEmpresa = async () => { throw new Error('banco caiu'); };
    const r = await app.inject({ url: '/api/dashboard/filtros', headers: auth(CID_A) });
    expect(r.statusCode).toBe(500);
    expect(r.json().traceId).toBeTruthy();
    expect(r.body).not.toContain('banco caiu');
  });
});
