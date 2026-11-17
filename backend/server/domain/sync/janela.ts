import { diasEntre, inicioDoDiaUnix, somarDias } from '../consumo/periodo.js';
import type { DataISO } from '../tipos.js';

/** A Meta guarda 1 ano de pricing_analytics (research R-06). */
export const LIMITE_HISTORICO_DIAS = 365;

export interface Janela {
  de: DataISO;
  ate: DataISO;
  inicioUnix: number;
  /** exclusivo: meia-noite do dia seguinte a `ate` */
  fimUnix: number;
}

/**
 * - Sem histórico: backfill de `diasBackfill`.
 * - Cliente reativado: desde `inativoDesde` (reprocessa o período parado).
 * - Normal: últimos `diasReprocesso` dias, porque a Meta revisa números com atraso.
 * Sempre limitado a 1 ano.
 */
export function calcularJanela(
  conta: { historicoDesde: DataISO | null; fuso: string },
  cliente: { inativoDesde: DataISO | null },
  hoje: DataISO,
  cfg: { diasBackfill: number; diasReprocesso: number },
): Janela {
  const limite = somarDias(hoje, -(LIMITE_HISTORICO_DIAS - 1));
  let de = conta.historicoDesde === null
    ? somarDias(hoje, -(Math.min(cfg.diasBackfill, LIMITE_HISTORICO_DIAS) - 1))
    : somarDias(hoje, -(cfg.diasReprocesso - 1));
  if (cliente.inativoDesde && cliente.inativoDesde < de) de = cliente.inativoDesde;
  if (de < limite) de = limite;
  return {
    de,
    ate: hoje,
    inicioUnix: inicioDoDiaUnix(de, conta.fuso),
    fimUnix: inicioDoDiaUnix(somarDias(hoje, 1), conta.fuso),
  };
}

export const diasNaJanela = (j: Janela) => diasEntre(j.de, j.ate) + 1;
