import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { criarDashboardService } from '../../server/services/dashboard.service.js';
import { criarExportacaoService, periodoDoMes } from '../../server/services/exportacao.service.js';
import { CID_A, ConsumoMemoria, RepoMemoria } from '../fakes.js';

const CID_B = '22222222-2222-4222-8222-222222222222';

/** Lê uma aba do relatório: textos do topo, linhas por título de coluna e a linha de total. */
async function lerAba(arquivo: Buffer, aba: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
  const s = wb.getWorksheet(aba)!;
  // Array.from preenche os buracos (linhas vazias) que o ExcelJS deixa no array.
  const valores = Array.from(s.getSheetValues(), (l) => (Array.isArray(l) ? l.slice(1) : []));
  const iTitulos = valores.findIndex((l) => l[0] === 'Cliente');
  const titulos = valores[iTitulos] as string[];
  const iTotal = valores.findIndex((l, i) => i > iTitulos && l[0] === 'Total');
  const comoObjeto = (l: unknown[]) => Object.fromEntries(titulos.map((t, i) => [t, l[i] ?? '']));
  return {
    s, linhaTitulos: iTitulos,
    topo: valores.slice(0, iTitulos).flat().filter(Boolean).map(String),
    linhas: valores.slice(iTitulos + 1, iTotal).map(comoObjeto),
    total: comoObjeto(valores[iTotal]!),
  };
}
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
    // Enviadas vêm do endpoint de envio: 2 dias em novembro, 1 em outubro (não entra em novembro).
    await consumo.upsertMensagens([
      { companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, data: '2026-11-02', enviadas: 120, entregues: 118 },
      { companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, data: '2026-11-10', enviadas: 30, entregues: 30 },
      { companyid: CID_A, contaWabaId: conta.id, numeroId: n.id, data: '2026-10-30', enviadas: 500, entregues: 500 },
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
      expect.objectContaining({ nome: 'Clínica São José', contas: 1, enviadas: 150, mensagens: 10, cobradas: 10, custoBrl: '10.000000', custoSituacao: 'completo' }),
      expect.objectContaining({ nome: 'Loja Sem Conta', contas: 0, mensagens: 0, custoBrl: '0.000000' }),
    ]);
  });

  it('relatório xlsx: uma linha por cliente e o total', async () => {
    const svc = await montar();
    const { arquivo, nome } = await svc.relatorioClientesXlsx('2026-10');
    expect(nome).toBe('consumo-clientes-2026-10.xlsx');
    const { topo, linhas, total } = await lerAba(arquivo, 'Clientes');
    expect(topo).toEqual(expect.arrayContaining(['Período: 01/10/2026 a 31/10/2026', expect.stringContaining('Todos os clientes')]));
    // Maior custo primeiro.
    expect(linhas.map((l) => l.Cliente)).toEqual(['Clínica São José', 'Loja Sem Conta']);
    expect(linhas[0]).toMatchObject({
      Taxi: 'Não', Status: 'Ativo', 'Contas WABA': 1, Enviadas: 500, Entregues: 500, 'Taxa de entrega': 1,
      'Mensagens cobradas': 99, 'Mensagens grátis': 0, 'Custo Meta estimado (R$)': 250, '% do custo total': 1,
      'Situação do custo': 'completo', companyid: CID_A,
    });
    expect(linhas[0]!['Custo por msg cobrada']).toBeCloseTo(250 / 99, 4);
    expect(linhas[1]).toMatchObject({ Taxi: 'Sim', 'Custo Meta estimado (R$)': 0, 'Taxa de entrega': '—' });
    expect(total).toMatchObject({ 'Contas WABA': 1, Enviadas: 500, 'Mensagens cobradas': 99, 'Custo Meta estimado (R$)': 250, 'Situação do custo': 'completo' });
    expect(total['Custo por msg cobrada']).toBeCloseTo(250 / 99, 4);
  });

  it('filtro Taxi: só os clientes Taxi, ou só os demais', async () => {
    const svc = await montar();
    expect((await svc.consumoDosClientes(undefined, true)).clientes.map((c) => c.nome)).toEqual(['Loja Sem Conta']);
    expect((await svc.consumoDosClientes(undefined, false)).clientes.map((c) => c.nome)).toEqual(['Clínica São José']);
    const { arquivo, nome } = await svc.relatorioClientesXlsx('2026-11', true);
    expect(nome).toBe('consumo-clientes-taxi-2026-11.xlsx');
    const { topo, linhas } = await lerAba(arquivo, 'Clientes');
    expect(topo).toEqual(expect.arrayContaining([expect.stringContaining('Só clientes Taxi')]));
    expect(linhas.map((l) => l.Cliente)).toEqual(['Loja Sem Conta']);
  });

  it('total vem do backend: soma dos custos conhecidos e marca de incompleto', async () => {
    const svc = await montar();
    expect((await svc.consumoDosClientes()).total).toEqual({ custoBrl: '10.00', incompleto: false, custoFasteriskBrl: '0.00' });
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
    expect((await svc.consumoDosClientes()).total).toMatchObject({ custoBrl: null, incompleto: true });
    const arquivo = (await svc.relatorioClientesXlsx()).arquivo;
    const { linhas, total } = await lerAba(arquivo, 'Clientes');
    expect(linhas[0]).toMatchObject({ 'Custo Meta estimado (R$)': 'indisponível (cotação não cadastrada)', '% do custo total': '—' });
    expect(total).toMatchObject({ 'Custo Meta estimado (R$)': 'indisponível', 'Situação do custo': 'nenhum cliente com custo' });
    const cat = await lerAba(arquivo, 'Por categoria');
    expect(cat.linhas[0]).toMatchObject({ 'Marketing\nmensagens': 10, 'Marketing\ncusto (R$)': '—' });
  });

  it('formato: títulos congelados e com filtro, números formatados, aba por categoria e pronto para imprimir', async () => {
    const svc = await montar();
    const arquivo = (await svc.relatorioClientesXlsx('2026-10')).arquivo;
    const { s, linhaTitulos } = await lerAba(arquivo, 'Clientes');
    const linha = linhaTitulos; // o índice do getSheetValues já é o número da linha
    expect(s.views[0]).toMatchObject({ state: 'frozen', ySplit: linha });
    expect(s.autoFilter).toBeTruthy();
    const formato = (titulo: string) => s.getColumn(((s.getRow(linha).values as unknown[]).indexOf(titulo))).numFmt;
    expect(formato('Enviadas')).toBe('#,##0');
    expect(formato('Custo Meta estimado (R$)')).toBe('"R$" #,##0.00');
    expect(formato('% do custo total')).toBe('0.0%');
    expect(s.pageSetup).toMatchObject({ orientation: 'landscape', fitToWidth: 1 });
    const cat = await lerAba(arquivo, 'Por categoria');
    expect(cat.linhas[0]).toMatchObject({ Cliente: 'Clínica São José', 'Marketing\nmensagens': 99, 'Marketing\ncusto (R$)': 250 });
    expect(cat.total).toMatchObject({ 'Marketing\nmensagens': 99, 'Custo total (R$)': 250 });
  });

  it('aba Resumo abre o arquivo: indicadores, maiores custos, categorias e propriedades do arquivo', async () => {
    const svc = await montar();
    const arquivo = (await svc.relatorioClientesXlsx('2026-10')).arquivo;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumo', 'Clientes', 'Por categoria']);
    expect(wb.title).toContain('01/10/2026 a 31/10/2026');
    expect(wb.company).toBe('Fasterisk');
    const r = wb.getWorksheet('Resumo')!;
    const textos = Array.from(r.getSheetValues(), (l) => (Array.isArray(l) ? l.slice(1) : [])).flat();
    // Indicadores: custo, enviadas, taxa de entrega e clientes com consumo.
    expect(textos).toEqual(expect.arrayContaining(['CUSTO ESTIMADO', 250, 'MENSAGENS ENVIADAS', 500, 'TAXA DE ENTREGA', 1, 'CLIENTES COM CONSUMO']));
    // Ranking: só quem tem custo, maior primeiro.
    const linhaTop = Array.from(r.getSheetValues()).findIndex((l) => Array.isArray(l) && l[2] === 'Clínica São José');
    expect(r.getRow(linhaTop).getCell(1).value).toBe(1);
    expect(r.getRow(linhaTop).getCell(3).value).toBe(250);
    // Por categoria: Marketing com as 99 mensagens e 100% do custo.
    const linhaMkt = Array.from(r.getSheetValues()).findIndex((l) => Array.isArray(l) && l[2] === 'Marketing');
    expect([3, 4, 5, 6].map((c) => r.getRow(linhaMkt).getCell(c).value)).toEqual([99, 1, 250, 1]);
  });
});
