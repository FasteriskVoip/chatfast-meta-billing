import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { CID_A, CID_B, ConsumoMemoria, RepoMemoria } from '../fakes.js';
import { auth, montarApp } from '../app.helper.js';

/** Cliente A nunca enxerga linhas do cliente B em nenhuma rota do dashboard. */
function cenario() {
  const repo = new RepoMemoria();
  const consumo = new ConsumoMemoria();
  const a = repo.addCliente({ companyid: CID_A, nome: 'Empresa A' });
  const b = repo.addCliente({ companyid: CID_B, nome: 'Empresa B' });
  const contaA = repo.addConta(a, { nome: 'WABA-A', moeda: 'BRL' });
  const contaB = repo.addConta(b, { nome: 'WABA-SEGREDO-B', moeda: 'BRL' });
  const nA = repo.addNumero(contaA, { display: '+55 61 1111-1111' });
  const nB = repo.addNumero(contaB, { display: '+55 99 9999-9999', verifiedName: 'NOME-B' });
  const base = { data: '2026-11-02', categoria: 'MARKETING' as const, tipoPreco: 'REGULAR' as const, pais: 'BR', tier: '', moeda: 'BRL' };
  void consumo.upsertConsumo([
    { ...base, companyid: CID_A, contaWabaId: contaA.id, numeroId: nA.id, volume: 1, custo: '1.000000' },
    { ...base, companyid: CID_B, contaWabaId: contaB.id, numeroId: nB.id, volume: 777, custo: '777.000000' },
  ]);
  void consumo.upsertMensagens([
    { companyid: CID_B, contaWabaId: contaB.id, numeroId: nB.id, data: '2026-11-02', enviadas: 999, entregues: 999 },
  ]);
  return { repo, consumo };
}

const q = 'de=2026-11-01&ate=2026-11-03';
// 777/999 só como número isolado: os IDs aleatórios (UUID, wabaId) às vezes contêm "777" ou "999" no meio
// e davam falso vazamento em ~1-2% das execuções.
const VAZAMENTO = /WABA-SEGREDO-B|NOME-B|9999-9999|\b777\b|\b999\b/;

describe('isolamento entre empresas', () => {
  it.each(['/api/dashboard/filtros', '/api/dashboard/status', `/api/dashboard/resumo?${q}`])('%s da empresa A não contém B', async (url) => {
    const { app } = await montarApp(cenario());
    const r = await app.inject({ url, headers: auth(CID_A) });
    expect(r.statusCode).toBe(200);
    expect(r.body).not.toMatch(VAZAMENTO);
  });

  it('export xlsx da empresa A não contém B', async () => {
    const { app } = await montarApp(cenario());
    const r = await app.inject({ url: `/api/dashboard/exportar.xlsx?${q}`, headers: auth(CID_A) });
    expect(r.statusCode).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.rawPayload as unknown as ArrayBuffer);
    const texto = wb.worksheets.map((w) => w.getSheetValues().map((l) => JSON.stringify(l)).join('\n')).join('\n');
    expect(texto).not.toMatch(VAZAMENTO);
  });

  it('companyid de B na query → 403 em todas as rotas do dashboard', async () => {
    const { app } = await montarApp(cenario());
    for (const url of ['/api/dashboard/filtros', '/api/dashboard/status', `/api/dashboard/resumo?${q}`, `/api/dashboard/exportar.xlsx?${q}`]) {
      const sep = url.includes('?') ? '&' : '?';
      const r = await app.inject({ url: `${url}${sep}companyid=${CID_B}`, headers: auth(CID_A) });
      expect(r.statusCode, url).toBe(403);
    }
    const r = await app.inject({ method: 'POST', url: '/api/dashboard/sincronizar', headers: auth(CID_A), payload: { companyid: CID_B } });
    expect(r.statusCode).toBe(403);
  });

  it('admin pode ver um cliente passando companyid', async () => {
    const { app } = await montarApp(cenario());
    const r = await app.inject({ url: `/api/dashboard/resumo?${q}&companyid=${CID_B}`, headers: auth(CID_A, true) });
    expect(r.statusCode).toBe(200);
    expect(r.json().total.volume).toBe(777);
  });
});
