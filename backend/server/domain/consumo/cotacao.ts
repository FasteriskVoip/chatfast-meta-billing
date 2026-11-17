import type { DataISO } from '../tipos.js';

// ponytail: aritmética decimal com BigInt em micro-unidades (6 casas), sem lib de decimal.
// Suficiente para somas e uma multiplicação por cotação de 4 casas; trocar por lib se surgir divisão encadeada.
const ESCALA = 1_000_000n;

/** "12.345678" → 12345678n (micro). Aceita sinal e até 6 casas (trunca o resto). */
export function paraMicro(valor: string): bigint {
  const neg = valor.startsWith('-');
  const [int = '0', frac = ''] = valor.replace(/^[-+]/, '').split('.');
  const micro = BigInt(int || '0') * ESCALA + BigInt((frac + '000000').slice(0, 6));
  return neg ? -micro : micro;
}

/** 12345678n → "12.345678" */
export function deMicro(m: bigint): string {
  const neg = m < 0n;
  const abs = neg ? -m : m;
  const s = `${abs / ESCALA}.${(abs % ESCALA).toString().padStart(6, '0')}`;
  return neg ? `-${s}` : s;
}

/** Divide com arredondamento meio-para-cima. */
export function dividir(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('divisão por zero');
  const q = a / b;
  const r = a % b;
  return 2n * (r < 0n ? -r : r) >= (b < 0n ? -b : b) ? q + (a < 0n !== b < 0n ? -1n : 1n) : q;
}

export interface Cotacao {
  /** valor BRL por 1 USD, decimal em string */
  valor: string;
  vigenteDesde: DataISO;
}

export interface CotacaoDoDia {
  valorMicro: bigint;
  /** true quando o dia é anterior à primeira cotação e usou a mais antiga */
  posterior: boolean;
}

/** Cotação vigente no dia: maior vigenteDesde ≤ dia; se nenhuma, a mais antiga (marcada). */
export function cotacaoDoDia(cotacoes: Cotacao[], dia: DataISO): CotacaoDoDia | null {
  if (cotacoes.length === 0) return null;
  let vigente: Cotacao | null = null;
  let maisAntiga = cotacoes[0]!;
  for (const c of cotacoes) {
    if (c.vigenteDesde <= dia && (!vigente || c.vigenteDesde > vigente.vigenteDesde)) vigente = c;
    if (c.vigenteDesde < maisAntiga.vigenteDesde) maisAntiga = c;
  }
  return vigente
    ? { valorMicro: paraMicro(vigente.valor), posterior: false }
    : { valorMicro: paraMicro(maisAntiga.valor), posterior: true };
}

export type MotivoSemBrl = 'sem_custo' | 'sem_cotacao' | 'moeda';

export type Conversao =
  | { brlMicro: bigint; posterior: boolean }
  | { brlMicro: null; motivo: MotivoSemBrl };

/** Converte o custo (moeda da WABA) para BRL. BRL passa direto; USD usa a cotação do dia (R-03). */
export function converter(custo: string | null, moeda: string, dia: DataISO, cotacoes: Cotacao[]): Conversao {
  if (custo === null) return { brlMicro: null, motivo: 'sem_custo' };
  const micro = paraMicro(custo);
  if (moeda === 'BRL') return { brlMicro: micro, posterior: false };
  if (moeda !== 'USD') return { brlMicro: null, motivo: 'moeda' };
  const c = cotacaoDoDia(cotacoes, dia);
  if (!c) return { brlMicro: null, motivo: 'sem_cotacao' };
  return { brlMicro: dividir(micro * c.valorMicro, ESCALA), posterior: c.posterior };
}
