import ExcelJS from 'exceljs';
import { ehCobrada, grupoDaCategoria } from '../domain/consumo/categorias.js';
import { converter, cotacaoDoDia, deMicro } from '../domain/consumo/cotacao.js';
import { hojeNoFuso } from '../domain/consumo/periodo.js';
import { custoEstimadoBrl } from '../domain/consumo/precos.js';
import { ErroNegocio } from '../domain/ports/erros.js';
import { FUSO_PADRAO } from '../domain/sync/normalizacao.js';
import type { ContaRepository } from '../domain/ports/repositorios.js';
import type { Grupo } from '../domain/tipos.js';
import type { DashboardService, FiltrosDashboard } from './dashboard.service.js';

const NOME_GRUPO: Record<Grupo, string> = {
  MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação', SERVICE: 'Serviço',
};

const SITUACAO: Record<string, string> = {
  completo: 'completo', parcial: 'parcial', indisponivel: 'indisponível', sem_cotacao: 'indisponível (cotação não cadastrada)',
};

/** Custo ausente vira texto, nunca 0 (FR-050). */
const valorOuTexto = (v: string | null, situacao: string) => (v === null ? SITUACAO[situacao] ?? 'indisponível' : Number(v));

const pct = (v: number | null) => (v === null ? '—' : Math.round(v * 1000) / 10);

/** 'AAAA-MM' → do dia 1 até o fim do mês (ou até hoje, no mês corrente). Sem mês: o mês corrente. */
export function periodoDoMes(mes: string | undefined, hoje: string) {
  const m = mes ?? hoje.slice(0, 7);
  const [ano, mesNum] = m.split('-').map(Number) as [number, number];
  const de = `${m}-01`;
  if (de > hoje) throw new ErroNegocio(400, 'VALIDACAO', 'mes: o mês ainda não começou');
  const fim = new Date(Date.UTC(ano, mesNum, 0)).toISOString().slice(0, 10);
  return { mes: m, de, ate: fim < hoje ? fim : hoje };
}

// ---------------------------------------------------------------- relatório do admin (todos os clientes)

type DadosClientes = Awaited<ReturnType<ReturnType<typeof criarExportacaoService>['consumoDosClientes']>>;
type LinhaCliente = DadosClientes['clientes'][number];

/** Paleta do design system (ARGB). */
const COR = {
  marca: 'FF5A55EA', marcaClaro: 'FFEEF0FD', texto: 'FF1E2A3A', cinza: 'FF8A94A6', cinzaClaro: 'FFABB2C4',
  zebra: 'FFF8F9FC', borda: 'FFE5E8EF', aviso: 'FFFFF1E6', avisoTexto: 'FFA16207',
  escuro: 'FF1E2A3A', barra: 'FF8F8BF2', ruim: 'FFF8B4B4', medio: 'FFFDE68A', bom: 'FFBBF7D0',
};
const FONTE = 'Calibri';
const FMT = { inteiro: '#,##0', reais: '"R$" #,##0.00', reaisFino: '"R$" #,##0.0000', pct: '0.0%' };
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const num = (v: string | null) => (v === null ? null : Number(v));
const borda = (cor = COR.borda) => ({ style: 'thin' as const, color: { argb: cor } });

/** Título, período e filtro no topo; devolve a linha onde começa a tabela. */
function cabecalhoRelatorio(s: ExcelJS.Worksheet, titulo: string, linhas: string[], colunas: number): number {
  s.views = [{ showGridLines: false }];
  s.mergeCells(1, 1, 1, colunas);
  const t = s.getCell(1, 1);
  t.value = titulo;
  t.font = { name: FONTE, bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.marca } };
  t.alignment = { vertical: 'middle', indent: 1 };
  s.getRow(1).height = 34;
  linhas.forEach((texto, i) => {
    s.mergeCells(2 + i, 1, 2 + i, colunas);
    const c = s.getCell(2 + i, 1);
    c.value = texto;
    c.font = { name: FONTE, size: 10, color: { argb: i === 0 ? COR.texto : COR.cinza }, bold: i === 0 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.marcaClaro } };
    c.alignment = { vertical: 'middle', indent: 1 };
    s.getRow(2 + i).height = 18;
  });
  return linhas.length + 3;
}

/** Linha de títulos da tabela: cor da marca, texto branco, quebra de linha, filtro e congelada. */
function linhaTitulos(s: ExcelJS.Worksheet, linha: number, titulos: string[]) {
  const r = s.getRow(linha);
  r.values = titulos;
  r.height = 32;
  r.eachCell((c) => {
    c.font = { name: FONTE, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.escuro } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  s.views = [{ state: 'frozen', ySplit: linha, xSplit: 1, showGridLines: false }];
  s.autoFilter = { from: { row: linha, column: 1 }, to: { row: linha, column: titulos.length } };
}

/** Zebra, bordas finas e números à direita em cada linha de dados. */
function estiloLinha(r: ExcelJS.Row, i: number, colunas: number, apagada = false) {
  for (let col = 1; col <= colunas; col++) {
    const c = r.getCell(col);
    if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.zebra } };
    c.border = { bottom: borda() };
    c.font = { name: FONTE, size: 10, color: { argb: apagada ? COR.cinzaClaro : COR.texto }, ...(col === 1 ? { bold: !apagada } : {}) };
    c.alignment = { vertical: 'middle', horizontal: typeof c.value === 'number' ? 'right' : col === 1 ? 'left' : 'center' };
  }
}

/** Linha de total: fundo da marca claro, negrito, borda em cima. */
function estiloTotal(r: ExcelJS.Row, colunas: number) {
  for (let col = 1; col <= colunas; col++) {
    const c = r.getCell(col);
    c.font = { name: FONTE, size: 10, bold: true, color: { argb: COR.texto } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.marcaClaro } };
    c.border = { top: borda(COR.marca), bottom: borda(COR.marca) };
    c.alignment = { vertical: 'middle', horizontal: typeof c.value === 'number' ? 'right' : col === 1 ? 'left' : 'center' };
  }
}

function notas(s: ExcelJS.Worksheet, depois: number, colunas: number, textos: string[]) {
  textos.forEach((texto, i) => {
    const linha = depois + 2 + i;
    s.mergeCells(linha, 1, linha, colunas);
    const c = s.getCell(linha, 1);
    c.value = texto;
    c.font = { name: FONTE, size: 9, italic: true, color: { argb: COR.cinza } };
    c.alignment = { wrapText: true, vertical: 'top' };
    s.getRow(linha).height = 24;
  });
}

function paraImpressao(s: ExcelJS.Worksheet, linhaTitulos: number) {
  s.pageSetup = {
    orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: `${linhaTitulos}:${linhaTitulos}`, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  s.headerFooter = { oddFooter: '&LConsumo Meta&RPágina &P de &N' };
}

/** Maior custo primeiro; custo ausente vai para o fim (nunca vira 0 na ordenação). */
const porCusto = (a: LinhaCliente, b: LinhaCliente) => (num(b.custoBrl) ?? -1) - (num(a.custoBrl) ?? -1) || a.nome.localeCompare(b.nome, 'pt-BR');

function abaClientes(wb: ExcelJS.Workbook, { periodo, clientes, total }: DadosClientes, filtro: string, geradoEm: string) {
  const s = wb.addWorksheet('Clientes', { properties: { tabColor: { argb: COR.marca } } });
  const colunas = [
    { titulo: 'Cliente', largura: 30 },
    { titulo: 'Taxi', largura: 7 },
    { titulo: 'Status', largura: 9 },
    { titulo: 'Contas WABA', largura: 9, fmt: FMT.inteiro },
    { titulo: 'Enviadas', largura: 12, fmt: FMT.inteiro },
    { titulo: 'Entregues', largura: 12, fmt: FMT.inteiro },
    { titulo: 'Taxa de entrega', largura: 10, fmt: FMT.pct },
    { titulo: 'Mensagens cobradas', largura: 12, fmt: FMT.inteiro },
    { titulo: 'Mensagens grátis', largura: 12, fmt: FMT.inteiro },
    { titulo: 'Custo Meta estimado (R$)', largura: 16, fmt: FMT.reais },
    { titulo: '% do custo total', largura: 10, fmt: FMT.pct },
    { titulo: 'Custo por msg cobrada', largura: 13, fmt: FMT.reaisFino },
    { titulo: 'Situação do custo', largura: 22 },
    { titulo: 'Grupo Fasterisk', largura: 14 },
    { titulo: 'Custo Fasterisk (R$)', largura: 16, fmt: FMT.reais },
    { titulo: 'companyid', largura: 38 },
  ];
  const n = colunas.length;
  const inicio = cabecalhoRelatorio(s, 'Consumo WhatsApp Cloud API: clientes', [
    `Período: ${dataBr(periodo.de)} a ${dataBr(periodo.ate)}`,
    `${filtro} · ${clientes.length} cliente(s) · gerado em ${geradoEm}`,
  ], n);
  colunas.forEach((c, i) => {
    s.getColumn(i + 1).width = c.largura;
    if (c.fmt) s.getColumn(i + 1).numFmt = c.fmt;
  });
  linhaTitulos(s, inicio, colunas.map((c) => c.titulo));

  const totalNum = num(total.custoBrl);
  [...clientes].sort(porCusto).forEach((c, i) => {
    const custo = num(c.custoBrl);
    const r = s.addRow([
      c.nome, c.taxi ? 'Sim' : 'Não', c.status === 'ATIVO' ? 'Ativo' : 'Inativo', c.contas, c.enviadas, c.entregues,
      c.taxaEntrega ?? '—', c.cobradas, c.gratuitas,
      valorOuTexto(c.custoBrl, c.custoSituacao),
      custo !== null && totalNum ? custo / totalNum : '—',
      num(c.custoPorCobradaBrl) ?? '—',
      SITUACAO[c.custoSituacao], c.grupoCusto ?? '', num(c.custoFasteriskBrl) ?? '', c.companyid,
    ]);
    estiloLinha(r, i, n, c.status === 'INATIVO');
    r.getCell(n).font = { size: 9, color: { argb: COR.cinzaClaro } };
    // Custo parcial/ausente salta aos olhos: o valor real é maior ou não existe.
    if (c.custoSituacao !== 'completo') {
      for (const col of [10, 13]) {
        const cel = r.getCell(col);
        cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.aviso } };
        cel.font = { color: { argb: COR.avisoTexto }, italic: custo === null };
      }
    }
  });

  const soma = (k: 'contas' | 'enviadas' | 'entregues' | 'cobradas' | 'gratuitas') => clientes.reduce((t, c) => t + c[k], 0);
  const enviadas = soma('enviadas');
  const cobradas = soma('cobradas');
  // Média por mensagem só entre quem tem custo: cobradas sem custo conhecido puxariam a média para baixo.
  const cobradasComCusto = clientes.filter((c) => c.custoBrl !== null).reduce((t, c) => t + c.cobradas, 0);
  const rt = s.addRow([
    'Total', '', '', soma('contas'), enviadas, soma('entregues'), enviadas ? soma('entregues') / enviadas : '—', cobradas, soma('gratuitas'),
    totalNum ?? 'indisponível', totalNum !== null ? 1 : '—', cobradasComCusto ? (totalNum ?? 0) / cobradasComCusto : '—',
    totalNum === null ? 'nenhum cliente com custo' : total.incompleto ? 'parcial (há clientes sem custo completo)' : 'completo',
    '', num(total.custoFasteriskBrl) ?? '', '',
  ]);
  estiloTotal(rt, n);
  // Recursos nativos do Excel: barra no custo e na participação; escala de cor na taxa de entrega.
  const de = inicio + 1;
  const ate = rt.number - 1;
  if (ate >= de) {
    for (const col of ['J', 'K']) {
      s.addConditionalFormatting({
        ref: `${col}${de}:${col}${ate}`,
        rules: [{ type: 'dataBar', priority: 1, gradient: false, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: COR.barra } } as ExcelJS.ConditionalFormattingRule],
      });
    }
    s.addConditionalFormatting({
      ref: `G${de}:G${ate}`,
      rules: [{
        type: 'colorScale', priority: 2,
        cfvo: [{ type: 'num', value: 0.8 }, { type: 'num', value: 0.9 }, { type: 'num', value: 0.97 }],
        color: [{ argb: COR.ruim }, { argb: COR.medio }, { argb: COR.bom }],
      } as ExcelJS.ConditionalFormattingRule],
    });
  }
  notas(s, rt.number, n, [
    'Custo estimado em R$: a Meta informa o custo na moeda de cada WABA; as contas em dólar são convertidas pela cotação de cada dia (PTAX do Banco Central ou cadastro manual). A cobrança oficial é a fatura da Meta.',
    '"Parcial": parte do período sem custo informado pela Meta, então o valor real é maior ou igual. "Indisponível": a Meta não informa custo (ex.: linha de crédito de parceiro) ou falta a cotação. Custo ausente nunca é tratado como zero.',
    'Custo Fasterisk: só clientes Taxi. Preço do grupo de custo × mensagens cobradas; é o valor que o cliente vê no dashboard.',
    'Enviadas e entregues contam todas as mensagens. Mensagens cobradas e grátis seguem a classificação de cobrança da Meta (pricing_analytics), que conta só as entregues.',
  ]);
  paraImpressao(s, inicio);
}

const COLS_CATEGORIA: Grupo[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];

/** Bloco de indicador: rótulo pequeno, valor grande, detalhe em cinza (3 linhas, 2 colunas mescladas). */
function indicador(s: ExcelJS.Worksheet, linha: number, col: number, rotulo: string, valor: number | string, fmt: string, detalhe: string) {
  const bloco = [[rotulo, 9, COR.cinza, false], [valor, 20, COR.escuro, true], [detalhe, 9, COR.cinza, false]] as const;
  bloco.forEach(([v, size, cor, bold], i) => {
    s.mergeCells(linha + i, col, linha + i, col + 1);
    const c = s.getCell(linha + i, col);
    c.value = v;
    c.font = { name: FONTE, size, bold, color: { argb: cor } };
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.zebra } };
    if (i === 1 && typeof v === 'number') c.numFmt = fmt;
  });
  for (let i = 0; i < 3; i++) {
    for (const cc of [col, col + 1]) {
      const c = s.getCell(linha + i, cc);
      c.border = {
        top: i === 0 ? borda(COR.marca) : undefined,
        bottom: i === 2 ? borda() : undefined,
        left: cc === col ? borda() : undefined,
        right: cc === col + 1 ? borda() : undefined,
      };
    }
  }
}

/** Título de seção dentro do resumo. */
function secao(s: ExcelJS.Worksheet, linha: number, colunas: number, texto: string) {
  s.mergeCells(linha, 1, linha, colunas);
  const c = s.getCell(linha, 1);
  c.value = texto;
  c.font = { name: FONTE, size: 12, bold: true, color: { argb: COR.marca } };
  c.border = { bottom: borda(COR.marca) };
  s.getRow(linha).height = 22;
}

/** Aba de abertura: indicadores, maiores custos e distribuição por categoria. */
function abaResumo(wb: ExcelJS.Workbook, { periodo, clientes, total }: DadosClientes, filtro: string, geradoEm: string) {
  const s = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: COR.marca } } });
  const n = 8;
  [6, 30, 16, 12, 14, 14, 16, 14].forEach((w, i) => (s.getColumn(i + 1).width = w));
  cabecalhoRelatorio(s, 'Relatório de consumo · WhatsApp Cloud API', [
    `Período: ${dataBr(periodo.de)} a ${dataBr(periodo.ate)}`,
    `${filtro} · gerado em ${geradoEm}`,
  ], n);

  const soma = (k: 'enviadas' | 'entregues' | 'cobradas') => clientes.reduce((t, c) => t + c[k], 0);
  const enviadas = soma('enviadas');
  const entregues = soma('entregues');
  const totalNum = num(total.custoBrl);
  const comConsumo = clientes.filter((c) => c.enviadas > 0 || c.mensagens > 0).length;
  const ativos = clientes.filter((c) => c.status === 'ATIVO').length;
  indicador(s, 5, 1, 'CUSTO ESTIMADO', totalNum ?? '—', FMT.reais,
    totalNum === null ? 'nenhum cliente com custo' : total.incompleto ? 'parcial: há clientes sem custo completo' : 'completo');
  indicador(s, 5, 3, 'MENSAGENS ENVIADAS', enviadas, FMT.inteiro, `${entregues.toLocaleString('pt-BR')} entregues`);
  indicador(s, 5, 5, 'TAXA DE ENTREGA', enviadas ? entregues / enviadas : '—', FMT.pct, 'entregues ÷ enviadas');
  indicador(s, 5, 7, 'CLIENTES COM CONSUMO', comConsumo, FMT.inteiro, `de ${clientes.length} (${ativos} ativos)`);
  s.getRow(6).height = 30;

  // Maiores custos.
  let linha = 10;
  secao(s, linha, n, 'Maiores custos do período');
  linha += 1;
  const titulosTop = ['#', 'Cliente', 'Custo estimado (R$)', '% do total', 'Enviadas', 'Msgs cobradas', 'Custo por msg', 'Situação'];
  const rTit = s.getRow(linha);
  rTit.values = titulosTop;
  rTit.eachCell((c) => {
    c.font = { name: FONTE, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.escuro } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  rTit.height = 28;
  const top = [...clientes].filter((c) => num(c.custoBrl) !== null).sort(porCusto).slice(0, 10);
  const inicioTop = linha + 1;
  top.forEach((c, i) => {
    const custo = num(c.custoBrl)!;
    const r = s.getRow(inicioTop + i);
    r.values = [i + 1, c.nome, custo, totalNum ? custo / totalNum : '—', c.enviadas, c.cobradas, num(c.custoPorCobradaBrl) ?? '—', SITUACAO[c.custoSituacao]];
    [null, null, FMT.reais, FMT.pct, FMT.inteiro, FMT.inteiro, FMT.reaisFino, null].forEach((fmt, k) => { if (fmt) r.getCell(k + 1).numFmt = fmt; });
    estiloLinha(r, i, n);
  });
  if (top.length) {
    s.addConditionalFormatting({
      ref: `C${inicioTop}:C${inicioTop + top.length - 1}`,
      rules: [{ type: 'dataBar', priority: 1, gradient: false, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: COR.barra } } as ExcelJS.ConditionalFormattingRule],
    });
  } else {
    s.mergeCells(inicioTop, 1, inicioTop, n);
    s.getCell(inicioTop, 1).value = 'Nenhum cliente com custo informado no período.';
    s.getCell(inicioTop, 1).font = { name: FONTE, italic: true, color: { argb: COR.cinza } };
  }

  // Por categoria.
  linha = inicioTop + Math.max(top.length, 1) + 2;
  secao(s, linha, n, 'Por categoria de cobrança');
  linha += 1;
  const rCat = s.getRow(linha);
  rCat.values = ['', 'Categoria', 'Mensagens', '% das msgs', 'Custo estimado (R$)', '% do custo'];
  rCat.eachCell((c, col) => {
    if (col === 1) return;
    c.font = { name: FONTE, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.escuro } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  rCat.height = 28;
  const volTotal = clientes.reduce((t, c) => t + COLS_CATEGORIA.reduce((x, g) => x + (c.categorias[g]?.volume ?? 0), 0), 0);
  COLS_CATEGORIA.forEach((g, i) => {
    const vol = clientes.reduce((t, c) => t + (c.categorias[g]?.volume ?? 0), 0);
    const custos = clientes.map((c) => num(c.categorias[g]?.custoBrl ?? null)).filter((x): x is number => x !== null);
    const custo = custos.length ? custos.reduce((t, x) => t + x, 0) : null;
    const r = s.getRow(linha + 1 + i);
    r.values = ['', NOME_GRUPO[g], vol, volTotal ? vol / volTotal : '—', custo ?? '—', custo !== null && totalNum ? custo / totalNum : '—'];
    [null, null, FMT.inteiro, FMT.pct, FMT.reais, FMT.pct].forEach((fmt, k) => { if (fmt) r.getCell(k + 1).numFmt = fmt; });
    estiloLinha(r, i, 6);
    r.getCell(1).fill = { type: 'pattern', pattern: 'none' };
  });

  notas(s, linha + COLS_CATEGORIA.length, n, [
    'Valores estimados a partir dos dados da Meta (pricing_analytics e analytics); a cobrança oficial é a fatura da Meta. Detalhes por cliente nas abas "Clientes" e "Por categoria".',
  ]);
  s.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  s.headerFooter = { oddFooter: '&LConsumo Meta&RPágina &P de &N' };
}

function abaCategorias(wb: ExcelJS.Workbook, { periodo, clientes, total }: DadosClientes, filtro: string) {
  const s = wb.addWorksheet('Por categoria');
  const titulos = ['Cliente', ...COLS_CATEGORIA.flatMap((g) => [`${NOME_GRUPO[g]}\nmensagens`, `${NOME_GRUPO[g]}\ncusto (R$)`]), 'Custo total (R$)'];
  const n = titulos.length;
  const inicio = cabecalhoRelatorio(s, 'Consumo por categoria de cobrança', [
    `Período: ${dataBr(periodo.de)} a ${dataBr(periodo.ate)} · ${filtro}`,
  ], n);
  s.getColumn(1).width = 30;
  for (let col = 2; col <= n; col++) {
    s.getColumn(col).width = 13;
    s.getColumn(col).numFmt = col === n || col % 2 === 1 ? FMT.reais : FMT.inteiro;
  }
  linhaTitulos(s, inicio, titulos);

  [...clientes].sort(porCusto).forEach((c, i) => {
    const r = s.addRow([
      c.nome,
      ...COLS_CATEGORIA.flatMap((g) => [c.categorias[g]?.volume ?? 0, num(c.categorias[g]?.custoBrl ?? null) ?? '—']),
      valorOuTexto(c.custoBrl, c.custoSituacao),
    ]);
    estiloLinha(r, i, n, c.status === 'INATIVO');
  });
  const somaCat = (g: Grupo) => clientes.reduce((t, c) => t + (c.categorias[g]?.volume ?? 0), 0);
  const custoCat = (g: Grupo) => {
    const v = clientes.map((c) => num(c.categorias[g]?.custoBrl ?? null)).filter((x): x is number => x !== null);
    return v.length ? v.reduce((t, x) => t + x, 0) : '—';
  };
  const rt = s.addRow(['Total', ...COLS_CATEGORIA.flatMap((g) => [somaCat(g), custoCat(g)]), num(total.custoBrl) ?? 'indisponível']);
  estiloTotal(rt, n);
  notas(s, rt.number, n, ['Serviço (respostas dentro da janela de 24h) e entradas por anúncio são gratuitos. "—" = custo não informado pela Meta.']);
  paraImpressao(s, inicio);
}

export function criarExportacaoService(d: {
  dashboard: Pick<DashboardService, 'dadosResumo'>;
  repo: Pick<ContaRepository, 'clientePorCompanyid' | 'listarClientes'>;
  agora?: () => Date;
}) {
  const agora = d.agora ?? (() => new Date());

  /** Consumo de todos os clientes num mês (admin): o mesmo cálculo do dashboard de cada um. */
  async function consumoDosClientes(mes?: string, taxi?: boolean) {
    const periodo = periodoDoMes(mes, hojeNoFuso(agora(), FUSO_PADRAO));
    const alvo = (await d.repo.listarClientes()).filter((x) => taxi === undefined || x.taxi === taxi);
    // Em paralelo (o pool do Prisma limita as conexões). ponytail: um resumo por cliente; com centenas, agregar numa consulta só.
    const clientes = await Promise.all(alvo.map(async (c) => {
      // resumo = o que o cliente vê (preço Fasterisk se Taxi); resumoMeta = custo da Meta, o que a Fasterisk paga.
      const { resumo: visto, resumoMeta: resumo, fasterisk, contas } = await d.dashboard.dadosResumo(c.companyid, { de: periodo.de, ate: periodo.ate });
      return {
        clienteId: c.id, nome: c.nome, companyid: c.companyid, status: c.status, taxi: c.taxi, contas: contas.length,
        enviadas: resumo.envio.enviadas, entregues: resumo.envio.entregues, taxaEntrega: resumo.envio.taxaEntrega,
        mensagens: resumo.total.volume, cobradas: resumo.total.cobradas, gratuitas: resumo.total.volume - resumo.total.cobradas,
        custoBrl: resumo.total.custoBrl, custoSituacao: resumo.total.custoSituacao,
        custoPorCobradaBrl: resumo.total.custoMedioPorCobradaBrl,
        grupoCusto: fasterisk?.grupo ?? null,
        custoFasteriskBrl: fasterisk ? visto.total.custoBrl : null,
        categorias: Object.fromEntries(resumo.categorias.map((x) => [x.categoria, { volume: x.volume, custoBrl: x.custoBrl }])) as
          Record<Grupo, { volume: number; custoBrl: string | null }>,
      };
    }));
    // Soma só os custos conhecidos; nenhum conhecido = ausente (null), nunca 0. Um lugar só para tela e relatório.
    const conhecidos = clientes.filter((c) => c.custoBrl !== null);
    const fasteriskConhecidos = clientes.filter((c) => c.custoFasteriskBrl !== null);
    const total = {
      custoBrl: conhecidos.length ? conhecidos.reduce((t, c) => t + Number(c.custoBrl), 0).toFixed(2) : null,
      incompleto: clientes.some((c) => c.custoSituacao !== 'completo'),
      custoFasteriskBrl: fasteriskConhecidos.length ? fasteriskConhecidos.reduce((t, c) => t + Number(c.custoFasteriskBrl), 0).toFixed(2) : null,
    };
    return { periodo, clientes, total };
  }

  return {
    consumoDosClientes,

    /** Relatório do admin: aba "Clientes" (uma linha por cliente, do maior custo para o menor) e "Por categoria". */
    async relatorioClientesXlsx(mes?: string, taxi?: boolean): Promise<{ arquivo: Buffer; nome: string }> {
      const dados = await consumoDosClientes(mes, taxi);
      const wb = new ExcelJS.Workbook();
      const filtro = taxi === undefined ? 'Todos os clientes' : taxi ? 'Só clientes Taxi' : 'Só clientes que não são Taxi';
      const geradoEm = agora().toLocaleString('pt-BR', { timeZone: FUSO_PADRAO, dateStyle: 'short', timeStyle: 'short' });
      Object.assign(wb, {
        creator: 'Consumo Meta', lastModifiedBy: 'Consumo Meta', company: 'Fasterisk', created: agora(), modified: agora(),
        title: `Consumo WhatsApp Cloud API · ${dataBr(dados.periodo.de)} a ${dataBr(dados.periodo.ate)}`,
        subject: `Relatório de consumo e custo estimado por cliente (${filtro})`,
      });
      abaResumo(wb, dados, filtro, geradoEm);
      abaClientes(wb, dados, filtro, geradoEm);
      abaCategorias(wb, dados, filtro);
      const sufixo = taxi === undefined ? '' : taxi ? '-taxi' : '-nao-taxi';
      return { arquivo: Buffer.from(await wb.xlsx.writeBuffer()), nome: `consumo-clientes${sufixo}-${dados.periodo.mes}.xlsx` };
    },

    async xlsx(companyid: string, f: FiltrosDashboard): Promise<{ arquivo: Buffer; nome: string }> {
      const empresa = (await d.repo.clientePorCompanyid(companyid))?.nome ?? companyid;
      const { resumo, fasterisk, custo: tipoCusto, contas, consumo, cotacoes, infos, ultimoSync } = await d.dashboard.dadosResumo(companyid, f);
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Consumo Meta';

      const r = wb.addWorksheet('Resumo');
      r.addRows([
        ['Consumo WhatsApp Cloud API', empresa],
        ['Período', `${f.de} a ${f.ate}`],
        ['Dados até', ultimoSync ? ultimoSync.toISOString() : '—'],
        ['Observação', fasterisk && tipoCusto === 'fasterisk'
          ? `Custo em R$: R$ ${fasterisk.precoBrl.replace('.', ',')} por mensagem cobrada`
          : 'Custo em R$ estimado pela cotação vigente em cada dia'],
        [],
        ['Enviadas', resumo.envio.enviadas],
        ['Entregues', resumo.envio.entregues],
        ['Taxa de entrega (%)', pct(resumo.envio.taxaEntrega)],
        ['Média diária (enviadas)', resumo.envio.mediaDiaria],
        ['Pico diário', resumo.envio.pico ? `${resumo.envio.pico.enviadas} em ${resumo.envio.pico.data}` : '—'],
        [],
        ['Categoria', 'Volume', '% do volume', 'Cobradas', 'Gratuitas', 'Custo R$', 'Situação do custo'],
        ...resumo.categorias.map((c) => [
          NOME_GRUPO[c.categoria], c.volume, pct(c.percentual), c.cobradas, c.gratuitas,
          valorOuTexto(c.custoBrl, c.custoSituacao), SITUACAO[c.custoSituacao],
        ]),
        ['Total', resumo.total.volume, 100, resumo.total.cobradas, resumo.total.volume - resumo.total.cobradas,
          valorOuTexto(resumo.total.custoBrl, resumo.total.custoSituacao), SITUACAO[resumo.total.custoSituacao]],
      ]);
      if (resumo.total.volume === 0) r.addRow(['Nenhum consumo no período']);

      const n = wb.addWorksheet('Por número');
      n.addRow(['WABA', 'Número', 'Nome verificado', 'Qualidade', 'Enviadas', 'Entregues', 'Taxa (%)',
        'Marketing', 'Utilidade', 'Autenticação', 'Serviço', 'Custo R$', '% do total']);
      for (const x of resumo.porNumero) {
        n.addRow([x.conta, x.display, x.nomeVerificado ?? '', x.qualidade, x.enviadas, x.entregues, pct(x.taxaEntrega),
          x.porCategoria.MARKETING, x.porCategoria.UTILITY, x.porCategoria.AUTHENTICATION, x.porCategoria.SERVICE,
          x.custoBrl === null ? 'indisponível' : Number(x.custoBrl), pct(x.percentualDoTotal)]);
      }

      const dia = wb.addWorksheet('Diário');
      dia.addRow(['data', 'conta', 'número', 'categoria', 'categoria_meta', 'tipo_preco', 'volume', 'cobradas', 'gratuitas',
        'custo_moeda_conta', 'moeda', 'cotacao', 'custo_brl', 'situacao']);
      const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
      const numero = new Map(infos.map((i) => [i.id, i.display]));
      const linhas = f.categoria ? consumo.filter((l) => grupoDaCategoria(l.categoria) === f.categoria) : consumo;
      for (const l of linhas) {
        const g = grupoDaCategoria(l.categoria);
        // Mesmo critério da tela: sem custo da Meta, estima pela tabela de preços em BRL.
        const estimado = l.custo === null ? custoEstimadoBrl(l) : null;
        const custo = estimado ?? l.custo;
        const moeda = estimado !== null ? 'BRL' : l.moeda;
        const conv = converter(custo, moeda, l.data, cotacoes);
        const cot = moeda === 'USD' ? cotacaoDoDia(cotacoes, l.data) : null;
        const situacao = conv.brlMicro === null
          ? conv.motivo === 'sem_cotacao' ? 'indisponível (cotação não cadastrada)' : 'indisponível'
          : estimado !== null ? 'estimado (tabela de preços)'
          : l.semCusto > 0 ? 'parcial' : conv.posterior ? 'convertido com cotação posterior' : 'completo';
        dia.addRow([
          l.data, nomeConta.get(l.contaId) ?? '', numero.get(l.numeroId) ?? '', g ? NOME_GRUPO[g] : 'Outra', l.categoria,
          l.tipoPreco, l.volume, ehCobrada(l.tipoPreco) ? l.volume : 0, ehCobrada(l.tipoPreco) ? 0 : l.volume,
          custo === null ? 'indisponível' : Number(custo), moeda,
          cot ? Number(deMicro(cot.valorMicro)) : moeda === 'BRL' ? 1 : '—',
          conv.brlMicro === null ? 'indisponível' : Number(deMicro(conv.brlMicro)), situacao,
        ]);
      }
      if (linhas.length === 0) dia.addRow(['Nenhum consumo no período']);

      for (const ws of [r, n, dia]) ws.columns.forEach((c) => (c.width = 16));
      const slug = empresa.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'empresa';
      return { arquivo: Buffer.from(await wb.xlsx.writeBuffer()), nome: `consumo-${slug}-${f.de}-${f.ate}.xlsx` };
    },
  };
}

export type ExportacaoService = ReturnType<typeof criarExportacaoService>;
