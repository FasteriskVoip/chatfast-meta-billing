import ExcelJS from 'exceljs';
import { ehCobrada, grupoDaCategoria } from '../domain/consumo/categorias.js';
import { converter, cotacaoDoDia, deMicro } from '../domain/consumo/cotacao.js';
import { custoEstimadoBrl } from '../domain/consumo/precos.js';
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

export function criarExportacaoService(d: {
  dashboard: Pick<DashboardService, 'dadosResumo'>;
  repo: Pick<ContaRepository, 'clientePorCompanyid'>;
}) {
  return {
    async xlsx(companyid: string, f: FiltrosDashboard): Promise<{ arquivo: Buffer; nome: string }> {
      const empresa = (await d.repo.clientePorCompanyid(companyid))?.nome ?? companyid;
      const { resumo, contas, consumo, cotacoes, infos, ultimoSync } = await d.dashboard.dadosResumo(companyid, f);
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Consumo Meta';

      const r = wb.addWorksheet('Resumo');
      r.addRows([
        ['Consumo WhatsApp Cloud API', empresa],
        ['Período', `${f.de} a ${f.ate}`],
        ['Dados até', ultimoSync ? ultimoSync.toISOString() : '—'],
        ['Observação', 'Custo em R$ estimado pela cotação vigente em cada dia'],
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
