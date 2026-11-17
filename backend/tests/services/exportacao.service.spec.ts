import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { criarDashboardService } from '../../server/services/dashboard.service.js';
import { criarExportacaoService } from '../../server/services/exportacao.service.js';
import { CID_A, ConsumoMemoria, RepoMemoria } from '../fakes.js';

async function montar(comDados = true) {
  const repo = new RepoMemoria();
  const consumo = new ConsumoMemoria();
  const cli = repo.addCliente({ companyid: CID_A, nome: 'Clínica São José' });
  const conta = repo.addConta(cli, { nome: 'WABA A', moeda: 'USD' });
  const n = repo.addNumero(conta);
  repo.cotacoes.push({ id: 'c', valor: '5.0000', vigenteDesde: '2026-11-01', criadoPor: 'u', criadoEm: new Date() });
  if (comDados) {
    const base = { companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, pais: 'BR', tier: '', moeda: 'USD' };
    await consumo.upsertConsumo([
      { ...base, data: '2026-11-02', categoria: 'MARKETING', tipoPreco: 'REGULAR', volume: 10, custo: '2.000000' },
      { ...base, data: '2026-11-03', categoria: 'UTILITY', tipoPreco: 'REGULAR', volume: 5, custo: null },
    ]);
  }
  const dashboard = criarDashboardService({ repo, consumo, sync: { sincronizarConta: async () => 'OK' }, emSegundoPlano: () => {} });
  const svc = criarExportacaoService({ dashboard, repo });
  const r = await svc.xlsx(CID_A, { de: '2026-11-01', ate: '2026-11-03' });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.arquivo as unknown as ArrayBuffer);
  return { r, wb, dashboard };
}

const valores = (ws: ExcelJS.Worksheet) => ws.getSheetValues().filter(Boolean).map((l) => (l as unknown[]).slice(1));

describe('exportacao.xlsx', () => {
  it('3 abas e nome de arquivo com a empresa', async () => {
    const { r, wb } = await montar();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumo', 'Por número', 'Diário']);
    expect(r.nome).toBe('consumo-clinica-sao-jose-2026-11-01-2026-11-03.xlsx');
  });

  it('aba Diário: colunas e custo ausente como "indisponível", nunca 0', async () => {
    const { wb } = await montar();
    const [cab, l1, l2] = valores(wb.getWorksheet('Diário')!);
    expect(cab).toEqual(['data', 'conta', 'número', 'categoria', 'categoria_meta', 'tipo_preco', 'volume', 'cobradas', 'gratuitas',
      'custo_moeda_conta', 'moeda', 'cotacao', 'custo_brl', 'situacao']);
    expect(l1).toEqual(['2026-11-02', 'WABA A', '+55 61 3399-3888', 'Marketing', 'MARKETING', 'REGULAR', 10, 10, 0, 2, 'USD', 5, 10, 'completo']);
    // sem custo da Meta → estimado: 5 × R$ 0,035
    expect(l2!.slice(9)).toEqual([0.175, 'BRL', 1, 0.175, 'estimado (tabela de preços)']);
  });

  it('totais iguais ao resumo da tela', async () => {
    const { wb, dashboard } = await montar();
    const resumo = await dashboard.resumo(CID_A, { de: '2026-11-01', ate: '2026-11-03' });
    const total = valores(wb.getWorksheet('Resumo')!).find((l) => l[0] === 'Total')!;
    expect(total[1]).toBe(resumo.total.volume);
    expect(total[5]).toBe(Number(resumo.total.custoBrl));
    expect(total[6]).toBe('completo');
  });

  it('recorte vazio → "Nenhum consumo no período"', async () => {
    const { wb } = await montar(false);
    expect(JSON.stringify(valores(wb.getWorksheet('Diário')!))).toContain('Nenhum consumo no período');
  });
});
