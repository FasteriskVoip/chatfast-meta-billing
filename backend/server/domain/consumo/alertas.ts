import type { DataISO } from '../tipos.js';
import type { SituacaoCusto } from './agregacao.js';

export type PeriodoAlerta = 'diario' | 'mensal';

/** O que vai para o webhook quando o custo do cliente passa do limite. */
export interface AlertaConsumo {
  evento: 'consumo.limite_diario' | 'consumo.limite_mensal';
  cliente: { id: string; nome: string; companyid: string };
  periodo: { de: DataISO; ate: DataISO };
  limiteBrl: string;
  custoBrl: string;
  /** completo, ou parcial (parte do período sem custo da Meta: o valor real é maior ou igual). */
  situacaoCusto: SituacaoCusto;
  disparadoEm: string;
}

/**
 * Passou do limite? Custo ausente nunca dispara (ausente ≠ 0).
 * Custo parcial dispara: o que já se sabe é um piso do valor real.
 */
export function excedeuLimite(limiteBrl: string | null, custoBrl: string | null): boolean {
  return limiteBrl !== null && custoBrl !== null && Number(custoBrl) >= Number(limiteBrl);
}

/** Chave do período: o próprio dia (diário) ou o 1º dia do mês (mensal). */
export const chavePeriodo = (periodo: PeriodoAlerta, hoje: DataISO): DataISO =>
  periodo === 'diario' ? hoje : `${hoje.slice(0, 7)}-01`;
