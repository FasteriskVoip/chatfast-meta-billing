import { hojeNoFuso } from '../consumo/periodo.js';
import {
  CATEGORIAS_META, TIPOS_PRECO, type CategoriaMeta, type DataISO, type Qualidade, type TipoPreco,
} from '../tipos.js';

export const FUSO_PADRAO = 'America/Fortaleza';

export function categoriaMeta(v: unknown): CategoriaMeta {
  const s = String(v ?? '').toUpperCase();
  return (CATEGORIAS_META as readonly string[]).includes(s) && s !== 'OUTRA' ? (s as CategoriaMeta) : 'OUTRA';
}

export function tipoPreco(v: unknown): TipoPreco {
  const s = String(v ?? '').toUpperCase();
  return (TIPOS_PRECO as readonly string[]).includes(s) && s !== 'OUTRO' ? (s as TipoPreco) : 'OUTRO';
}

export function qualidade(v: unknown): Qualidade {
  const s = String(v ?? '').toUpperCase();
  return s === 'GREEN' || s === 'YELLOW' || s === 'RED' ? s : 'UNKNOWN';
}

/** Custo da Meta → string decimal; ausente/inválido → null (nunca 0). */
export function custo(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(6) : null;
}

/** Bucket da Meta (unix) → dia no fuso da conta (research R-05). */
export const dataNoFuso = (inicioUnix: number, fuso: string): DataISO => hojeNoFuso(new Date(inicioUnix * 1000), fuso);

// ponytail: timezone_id da Meta às vezes vem como id numérico sem tabela pública; usa o padrão
// quando não for um nome IANA. Mapear ids se aparecer conta fora de America/Fortaleza.
export function fusoIana(timezoneMeta: string | null | undefined): string {
  if (!timezoneMeta || !timezoneMeta.includes('/')) return FUSO_PADRAO;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezoneMeta });
    return timezoneMeta;
  } catch {
    return FUSO_PADRAO;
  }
}

/** Compara números ignorando formatação ("+55 61 3399-3888" ≡ "556133993888"). */
export const soDigitos = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '');
