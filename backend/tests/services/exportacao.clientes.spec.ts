import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { criarDashboardService } from '../../server/services/dashboard.service.js';
import { criarExportacaoService, periodoDoMes } from '../../server/services/exportacao.service.js';
import { CID_A, ConsumoMemoria, RepoMemoria } from '../fakes.js';

const CID_B = '22222222-2222-4222-8222-222222222222';
// 2026-11-18 12:00 em Fortaleza
const AGORA = new Date('2026-11-18T15:00:00Z');

describe('periodoDoMes', () => {
  it('mês corrente vai até hoje; mês passado, até o último dia', () => {
    expect(periodoDoMes(undefined, '2026-11-18')).toEqual({ mes: '2026-11', de: '2026-11-01', ate: '2026-11-18' });
    expect(periodoDoMes('2026-10', '2026-11-18')).toEqual({ mes: '2026-10', de: '2026-10-01', ate: '2026-10-31' });
    expect(periodoDoMes('2026-02', '2026-11-18').ate).toBe('2026-02-28');
  });

  it('mês que ainda não começou → VALIDACAO', () => {
    expect(() => periodoDoMes('2026-12', '2026-11-18')).toThrow(expect.objectContaining({ codigo: 'VALIDACAO' }));
  });
});

describe('consumo e relatório de todos os clientes', () => {
  async function montar() {
    const repo = new RepoMemoria();
    const consumo = new ConsumoMemoria();
    const a = repo.addCliente({ companyid: CID_A, nome: 'Clínica São José' });
    repo.addCliente({ companyid: CID_B, nome: 'Loja Sem Conta', taxi: true });
    const conta = repo.addConta(a, { moeda: 'USD' });
    const n = repo.addNumero(conta);
    repo.cotacoes.push({ id: 'c', valor: '5.0000', vigenteDesde: '2026-10-01', criadoPor: 'u', criadoEm: new Date() });
    const base = { companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, pais: 'BR', tier: '', moeda: 'USD', tipoPreco: 'REGULAR' as const };
    await consumo.upsertConsumo([
      { ...base, data: '2026-11-02', categoria: 'MARKETING', volume: 10, custo: '2.000000' },
      // outubro não entra em novembro
      { ...base, data: '2026-10-30', categoria: 'MARKETING', volume: 99, custo: '50.000000' },
    ]);
    const dashboard = criarDashboardService({
      repo, consumo, sync: { sincronizarConta: async () => 'OK' }, emSegundoPlano: () => {}, agora: () => AGORA,
    });
    return criarExportacaoService({ dashboard, repo, agora: () => AGORA });
  }

  it('custo do mês por cliente, com o mesmo cálculo do dashboard', async () => {
    const svc = await montar();
    const r = await svc.consumoDosClientes();
    expect(r.periodo).toEqual({ mes: '2026-11', de: '2026-11-01', ate: '2026-11-18' });
    expect(r.clientes).toEqual([
      expect.objectContaining({ nome: 'Clínica São José', contas: 1, mensagens: 10, cobradas: 10, custoBrl: '10.000000', custoSituacao: 'completo' }),
      expect.objectContaining({ nome: 'Loja Sem Conta', contas: 0, mensagens: 0, custoBrl: '0.000000' }),
    ]);
  });

  it('relatório xlsx: uma linha por cliente e o total', async () => {
    const svc = await montar();
    const { arquivo, nome } = await svc.relatorioClientesXlsx('2026-10');
    expect(nome).toBe('consumo-clientes-2026-10.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
    const linhas = wb.getWorksheet('Clientes')!.getSheetValues().filter(Boolean).map((l) => (l as unknown[]).slice(1));
    expect(linhas[1]).toEqual(['Período', '2026-10-01 a 2026-10-31']);
    expect(linhas).toContainEqual(['Clientes', 'Todos']);
    expect(linhas).toContainEqual(['Clínica São José', CID_A, 'Ativo', 'Não', 1, 99, 99, 0, 250, 'completo']);
    expect(linhas).toContainEqual(['Loja Sem Conta', CID_B, 'Ativo', 'Sim', 0, 0, 0, 0, 0, 'completo']);
    expect(linhas.at(-1)).toEqual(['Total', '', '', '', 1, 99, 99, 0, 250, 'completo']);
  });

  it('filtro Taxi: só os clientes Taxi, ou só os demais', async () => {
    const svc = await montar();
    expect((await svc.consumoDosClientes(undefined, true)).clientes.map((c) => c.nome)).toEqual(['Loja Sem Conta']);
    expect((await svc.consumoDosClientes(undefined, false)).clientes.map((c) => c.nome)).toEqual(['Clínica São José']);
    const { arquivo, nome } = await svc.relatorioClientesXlsx('2026-11', true);
    expect(nome).toBe('consumo-clientes-taxi-2026-11.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
    const linhas = wb.getWorksheet('Clientes')!.getSheetValues().filter(Boolean).map((l) => (l as unknown[]).slice(1));
    expect(linhas).toContainEqual(['Clientes', 'Só clientes Taxi']);
    expect(linhas.some((l) => l[0] === 'Clínica São José')).toBe(false);
  });

  it('total vem do backend: soma dos custos conhecidos e marca de incompleto', async () => {
    const svc = await montar();
    expect((await svc.consumoDosClientes()).total).toEqual({ custoBrl: '10.00', incompleto: false });
  });

  it('nenhum cliente com custo (sem cotação): total ausente, nunca R$ 0,00', async () => {
    const repo = new RepoMemoria();
    const consumo = new ConsumoMemoria();
    const c = repo.addCliente({ companyid: CID_A, nome: 'Sem Cotação' });
    const conta = repo.addConta(c, { moeda: 'USD' });
    const n = repo.addNumero(conta);
    await consumo.upsertConsumo([{
      companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, pais: 'BR', tier: '', moeda: 'USD', tipoPreco: 'REGULAR',
      data: '2026-11-02', categoria: 'MARKETING', volume: 10, custo: '2.000000',
    }]);
    const dashboard = criarDashboardService({
      repo, consumo, sync: { sincronizarConta: async () => 'OK' }, emSegundoPlano: () => {}, agora: () => AGORA,
    });
    const svc = criarExportacaoService({ dashboard, repo, agora: () => AGORA });
    expect((await svc.consumoDosClientes()).total).toEqual({ custoBrl: null, incompleto: true });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await svc.relatorioClientesXlsx()).arquivo as unknown as ArrayBuffer);
    const linhas = wb.getWorksheet('Clientes')!.getSheetValues().filter(Boolean).map((l) => (l as unknown[]).slice(1));
    expect(linhas.at(-1)!.slice(-2)).toEqual(['indisponível', 'nenhum cliente com custo']);
  });
});
