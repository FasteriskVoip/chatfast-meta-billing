import type { DataISO } from '../tipos.js';

/** Cotação oficial do dólar (hoje: PTAX do Banco Central). Só dias úteis; lança erro se a fonte falhar. */
export interface FonteCotacao {
  /** R$ por US$ 1 (venda), com 4 casas, de cada dia útil entre `de` e `ate`. */
  dolarVenda(de: DataISO, ate: DataISO): Promise<{ data: DataISO; valor: string }[]>;
}
