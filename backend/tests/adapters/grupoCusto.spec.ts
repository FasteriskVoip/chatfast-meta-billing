import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CID_A, CID_B, CID_FASTERISK, ConsumoMemoria, RepoMemoria } from '../fakes.js';
import { auth, montarApp } from '../app.helper.js';

/** Cliente Taxi vê o preço do grupo Fasterisk; só o admin vê o custo da Meta. */
function cenario(taxi = true) {
  const repo = new RepoMemoria();
  const consumo = new ConsumoMemoria();
  const a = repo.addCliente({ companyid: CID_A, taxi });
  repo.addCliente({ companyid: CID_B, nome: 'Empresa B' });
  const conta = repo.addConta(a, { moeda: 'BRL' });
  const n = repo.addNumero(conta);
  const base = { companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, data: '2026-11-02', pais: 'BR', tier: '', moeda: 'BRL' };
  void consumo.upsertConsumo([
    { ...base, categoria: 'UTILITY', tipoPreco: 'REGULAR', volume: 100, custo: '3.500000' },
    { ...base, categoria: 'SERVICE', tipoPreco: 'FREE_CUSTOMER_SERVICE', volume: 40, custo: '0.000000' },
  ]);
  return { repo, consumo };
}
const q = 'de=2026-11-01&ate=2026-11-03';

describe('grupo de custo Fasterisk', () => {
  it('cliente Taxi vê grupo × cobradas e nunca o custo da Meta (nem pedindo custo=meta)', async () => {
    const { app } = await montarApp(cenario());
    for (const url of [`/api/dashboard/resumo?${q}`, `/api/dashboard/resumo?${q}&custo=meta`]) {
      const r = (await app.inject({ url, headers: auth(CID_A) })).json();
      expect(r.total).toMatchObject({ custoBrl: '8.400000', cobradas: 140, custoMedioPorCobradaBrl: '0.060000' });
      expect(r).toMatchObject({ fasterisk: { precoBrl: '0.0600' }, custo: 'fasterisk' });
      expect(JSON.stringify(r)).not.toContain('Standard');
      expect(JSON.stringify(r)).not.toContain('3.500000');
    }
  });

  it('admin alterna: Fasterisk por padrão, custo da Meta com custo=meta', async () => {
    const { app } = await montarApp(cenario());
    const adm = auth(CID_FASTERISK, true);
    const fast = (await app.inject({ url: `/api/dashboard/resumo?${q}&companyid=${CID_A}`, headers: adm })).json();
    expect(fast).toMatchObject({ custo: 'fasterisk', total: { custoBrl: '8.400000' } });
    const meta = (await app.inject({ url: `/api/dashboard/resumo?${q}&companyid=${CID_A}&custo=meta`, headers: adm })).json();
    expect(meta).toMatchObject({ custo: 'meta', fasterisk: { grupo: 'Standard' }, total: { custoBrl: '3.500000' } });
  });

  it('Excel do cliente Taxi não tem coluna de grátis', async () => {
    const { app } = await montarApp(cenario());
    const r = await app.inject({ url: `/api/dashboard/exportar.xlsx?${q}`, headers: auth(CID_A) });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.rawPayload as unknown as ArrayBuffer);
    const texto = wb.worksheets.map((w) => JSON.stringify(w.getSheetValues())).join(' ');
    expect(texto).not.toMatch(/gratuit|grátis/i);
    expect(texto).toContain('8.4');
  });

  it('cliente que não é Taxi continua com o custo da Meta', async () => {
    const { app } = await montarApp(cenario(false));
    const r = (await app.inject({ url: `/api/dashboard/resumo?${q}`, headers: auth(CID_A) })).json();
    expect(r.total.custoBrl).toBe('3.500000');
    expect(r.fasterisk).toBeNull();
  });

  it('admin cria grupo, troca o preço e associa ao cliente; o dashboard segue o grupo', async () => {
    const { repo, consumo } = cenario();
    const { app } = await montarApp({ repo, consumo });
    const adm = auth(CID_FASTERISK, true);
    const novo = await app.inject({ method: 'POST', url: '/api/admin/grupos-custo', headers: adm, payload: { nome: 'Premium', precoBrl: '0,05' } });
    expect(novo.statusCode).toBe(201);
    const g = novo.json();
    expect((await app.inject({ method: 'POST', url: '/api/admin/grupos-custo', headers: adm, payload: { nome: 'premium', precoBrl: 1 } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'PUT', url: `/api/admin/grupos-custo/${g.id}`, headers: adm, payload: { nome: 'Premium', precoBrl: '0.08' } })).statusCode).toBe(200);
    const id = repo.clientes[0]!.id;
    expect((await app.inject({ method: 'PATCH', url: `/api/admin/clientes/${id}`, headers: adm, payload: { grupoCustoId: randomUUID() } })).statusCode).toBe(422);
    expect((await app.inject({ method: 'PATCH', url: `/api/admin/clientes/${id}`, headers: adm, payload: { grupoCustoId: g.id } })).json()).toMatchObject({ grupoCustoId: g.id });
    expect(repo.auditoria.map((a) => a.acao)).toEqual(['grupo_custo.criar', 'grupo_custo.editar', 'cliente.grupo_custo']);
    const r = (await app.inject({ url: `/api/dashboard/resumo?${q}`, headers: auth(CID_A) })).json();
    expect(r.total.custoBrl).toBe('11.200000');
  });

  it('lista do admin traz custo Meta e custo Fasterisk', async () => {
    const { app } = await montarApp(cenario());
    const r = (await app.inject({ url: '/api/admin/consumo?mes=2026-11', headers: auth(CID_FASTERISK, true) })).json();
    expect(r.clientes.find((c: { companyid: string }) => c.companyid === CID_A)).toMatchObject({
      custoBrl: '3.500000', grupoCusto: 'Standard', custoFasteriskBrl: '8.400000',
    });
    expect(r.total).toMatchObject({ custoBrl: '3.50', custoFasteriskBrl: '8.40' });
  });

  it('preço inválido → 400', async () => {
    const { app } = await montarApp();
    for (const precoBrl of ['0', '-1', 'abc', '0.00001']) {
      const r = await app.inject({ method: 'POST', url: '/api/admin/grupos-custo', headers: auth(CID_FASTERISK, true), payload: { nome: 'X', precoBrl } });
      expect(r.statusCode, precoBrl).toBe(400);
    }
  });
});
