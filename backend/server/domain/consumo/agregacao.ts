import type { LinhaConsumo, LinhaMensagens } from '../ports/repositorios.js';
import { GRUPOS, type DataISO, type Grupo, type Qualidade } from '../tipos.js';
import { ehCobrada, grupoDaCategoria } from './categorias.js';
import { converter, deMicro, dividir, type Cotacao, type MotivoSemBrl } from './cotacao.js';
import { diasDoPeriodo } from './periodo.js';
import { custoEstimadoBrl } from './precos.js';

export type SituacaoCusto = 'completo' | 'parcial' | 'indisponivel' | 'sem_cotacao';

/** Acumula custo em BRL sabendo o que faltou: custo ausente nunca vira zero. */
class Custo {
  brl = 0n;
  convertidas = 0;
  faltas = 0;
  motivos = new Set<MotivoSemBrl>();
  posterior = false;
  diasSemCusto = new Set<DataISO>();

  somar(l: LinhaConsumo, cotacoes: Cotacao[]) {
    if (l.volume === 0 && l.custo === null) return;
    // Sem custo da Meta: estima pela tabela de preços (já em BRL).
    const estimado = l.custo === null ? custoEstimadoBrl(l) : null;
    const c = estimado !== null ? converter(estimado, 'BRL', l.data, cotacoes) : converter(l.custo, l.moeda, l.data, cotacoes);
    if (c.brlMicro === null) {
      this.faltas++;
      this.motivos.add(c.motivo);
      this.diasSemCusto.add(l.data);
      return;
    }
    this.brl += c.brlMicro;
    this.convertidas++;
    this.posterior ||= c.posterior;
    if (l.semCusto > 0 && estimado === null) {
      this.faltas++;
      this.motivos.add('sem_custo');
      this.diasSemCusto.add(l.data);
    }
  }

  get situacao(): SituacaoCusto {
    if (this.faltas === 0) return 'completo';
    if (this.convertidas > 0) return 'parcial';
    return this.motivos.size === 1 && this.motivos.has('sem_cotacao') ? 'sem_cotacao' : 'indisponivel';
  }

  /** null quando não há nenhum valor convertido (indisponível/sem cotação). */
  get valor(): string | null {
    return this.situacao === 'completo' || this.situacao === 'parcial' ? deMicro(this.brl) : null;
  }
}

export interface NumeroInfo {
  id: string;
  conta: string;
  display: string;
  nomeVerificado: string | null;
  qualidade: Qualidade;
}

export interface EntradaResumo {
  de: DataISO;
  ate: DataISO;
  /** hoje no fuso da conta */
  hoje: DataISO;
  grupo?: Grupo;
  consumo: LinhaConsumo[];
  mensagens: LinhaMensagens[];
  numeros: NumeroInfo[];
  cotacoes: Cotacao[];
}

const razao = (a: number, b: number) => (b === 0 ? null : a / b);
const porGrupo = <T>(f: () => T) => Object.fromEntries(GRUPOS.map((g) => [g, f()])) as Record<Grupo, T>;

export function agregarEnvio(mensagens: LinhaMensagens[], de: DataISO, ate: DataISO) {
  const porDia = new Map<DataISO, { enviadas: number; entregues: number }>();
  for (const d of diasDoPeriodo(de, ate)) porDia.set(d, { enviadas: 0, entregues: 0 });
  for (const m of mensagens) {
    const dia = porDia.get(m.data);
    if (!dia) continue;
    dia.enviadas += m.enviadas;
    dia.entregues += m.entregues;
  }
  let enviadas = 0;
  let entregues = 0;
  let diasComEnvio = 0;
  let pico: { data: DataISO; enviadas: number } | null = null;
  for (const [data, d] of porDia) {
    enviadas += d.enviadas;
    entregues += d.entregues;
    if (d.enviadas > 0) diasComEnvio++;
    if (d.enviadas > 0 && (!pico || d.enviadas > pico.enviadas)) pico = { data, enviadas: d.enviadas };
  }
  return {
    envio: {
      enviadas,
      entregues,
      naoEntregues: Math.max(enviadas - entregues, 0),
      taxaEntrega: razao(entregues, enviadas),
      mediaDiaria: diasComEnvio === 0 ? 0 : Math.round(enviadas / diasComEnvio),
      diasComEnvio,
      diasNoPeriodo: porDia.size,
      pico,
    },
    serieMensagens: [...porDia].map(([data, d]) => ({ data, ...d })),
  };
}

export function agregarConsumo(e: EntradaResumo) {
  const linhas = e.grupo
    ? e.consumo.filter((l) => grupoDaCategoria(l.categoria) === e.grupo)
    : e.consumo;

  const cats = porGrupo(() => ({ volume: 0, cobradas: 0, gratuitas: 0, custo: new Custo() }));
  const total = { volume: 0, cobradas: 0, custo: new Custo() };
  const dias = new Map(diasDoPeriodo(e.de, e.ate).map((d) => [d, porGrupo(() => ({ volume: 0, custo: new Custo() }))]));
  const nums = new Map<string, { custo: Custo; porCategoria: Record<Grupo, number> }>();

  for (const l of linhas) {
    const g = grupoDaCategoria(l.categoria);
    const cobrada = ehCobrada(l.tipoPreco);
    total.volume += l.volume;
    if (cobrada) total.cobradas += l.volume;
    total.custo.somar(l, e.cotacoes);

    let n = nums.get(l.numeroId);
    if (!n) nums.set(l.numeroId, (n = { custo: new Custo(), porCategoria: porGrupo(() => 0) }));
    n.custo.somar(l, e.cotacoes);
    if (!g) continue;
    n.porCategoria[g] += l.volume;

    const c = cats[g];
    c.volume += l.volume;
    if (cobrada) c.cobradas += l.volume;
    else c.gratuitas += l.volume;
    c.custo.somar(l, e.cotacoes);

    const dia = dias.get(l.data)?.[g];
    if (dia) {
      dia.volume += l.volume;
      dia.custo.somar(l, e.cotacoes);
    }
  }

  const custoTotal = total.custo.valor;
  const custoMedio =
    custoTotal !== null && total.cobradas > 0
      ? deMicro(dividir(total.custo.brl, BigInt(total.cobradas)))
      : null;

  return {
    categorias: GRUPOS.map((g) => ({
      categoria: g,
      volume: cats[g].volume,
      percentual: razao(cats[g].volume, total.volume) ?? 0,
      cobradas: cats[g].cobradas,
      gratuitas: cats[g].gratuitas,
      custoBrl: cats[g].custo.valor,
      custoSituacao: cats[g].custo.situacao,
    })),
    total: {
      volume: total.volume,
      categorias: GRUPOS.filter((g) => cats[g].volume > 0).length,
      cobradas: total.cobradas,
      custoBrl: custoTotal,
      custoMedioPorCobradaBrl: custoMedio,
      custoSituacao: total.custo.situacao,
      diasSemCusto: total.custo.diasSemCusto.size,
      convertidoComCotacaoPosterior: total.custo.posterior,
    },
    serieCategorias: [...dias].map(([data, gs]) => ({
      data,
      ...Object.fromEntries(GRUPOS.map((g) => [g, { volume: gs[g].volume, custoBrl: gs[g].custo.valor }])),
    })) as ({ data: DataISO } & Record<Grupo, { volume: number; custoBrl: string | null }>)[],
    porNumeroCusto: nums,
    totalCustoMicro: custoTotal === null ? null : total.custo.brl,
    totalVolume: total.volume,
  };
}

/** Monta a tabela por número; inclui números sem consumo (zerados). */
export function agregarPorNumero(
  e: EntradaResumo,
  consumo: ReturnType<typeof agregarConsumo>,
) {
  const envio = new Map<string, { enviadas: number; entregues: number }>();
  for (const m of e.mensagens) {
    const x = envio.get(m.numeroId) ?? { enviadas: 0, entregues: 0 };
    x.enviadas += m.enviadas;
    x.entregues += m.entregues;
    envio.set(m.numeroId, x);
  }
  // % do total pelo custo quando há custo; senão, pelo volume.
  const porCusto = consumo.totalCustoMicro !== null && consumo.totalCustoMicro > 0n;
  return e.numeros.map((n) => {
    const c = consumo.porNumeroCusto.get(n.id);
    const env = envio.get(n.id) ?? { enviadas: 0, entregues: 0 };
    const volume = c ? Object.values(c.porCategoria).reduce((a, b) => a + b, 0) : 0;
    const custoBrl = c ? c.custo.valor : null;
    const percentualDoTotal = porCusto
      ? c && custoBrl !== null
        ? Number(dividir(c.custo.brl * 1_000_000n, consumo.totalCustoMicro!)) / 1_000_000
        : 0
      : (razao(volume, consumo.totalVolume) ?? 0);
    return {
      numeroId: n.id,
      conta: n.conta,
      display: n.display,
      nomeVerificado: n.nomeVerificado,
      qualidade: n.qualidade,
      enviadas: env.enviadas,
      entregues: env.entregues,
      taxaEntrega: razao(env.entregues, env.enviadas),
      porCategoria: c?.porCategoria ?? porGrupo(() => 0),
      custoBrl,
      percentualDoTotal,
    };
  });
}

/** Resumo completo do dashboard (uma chamada recalcula a tela inteira). */
export function montarResumo(e: EntradaResumo) {
  const { envio, serieMensagens } = agregarEnvio(e.mensagens, e.de, e.ate);
  const consumo = agregarConsumo(e);
  return {
    periodo: { de: e.de, ate: e.ate, incluiHoje: e.de <= e.hoje && e.hoje <= e.ate },
    envio,
    categorias: consumo.categorias,
    total: consumo.total,
    serieCategorias: consumo.serieCategorias,
    serieMensagens,
    porNumero: agregarPorNumero(e, consumo),
  };
}

export type Resumo = ReturnType<typeof montarResumo>;
