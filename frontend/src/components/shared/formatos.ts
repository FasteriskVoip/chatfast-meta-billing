const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR');
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** null = custo indisponível: mostra "—", NUNCA "R$ 0,00". */
export const formatarBRL = (v: string | null | undefined) => (v === null || v === undefined ? '—' : brl.format(Number(v)));
export const formatarNumero = (v: number) => numero.format(v);
export const formatarPercentual = (v: number | null | undefined) => (v === null || v === undefined ? '—' : pct.format(v));

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' (sem passar por Date para não sofrer com fuso). */
export const formatarData = (iso: string) => iso.split('-').reverse().join('/');
export const formatarDiaMes = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
export const formatarDataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—';

const relativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
/** "há 5 minutos", "ontem"… Mais fácil de ler que a data cheia; a data cheia vai no title. */
export function tempoRelativo(iso: string | null, agora = Date.now()) {
  if (!iso) return '—';
  const s = Math.round((new Date(iso).getTime() - agora) / 1000);
  if (Math.abs(s) < 60) return 'agora mesmo';
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return relativo.format(m, 'minute');
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return relativo.format(h, 'hour');
  return relativo.format(Math.round(h / 24), 'day');
}
