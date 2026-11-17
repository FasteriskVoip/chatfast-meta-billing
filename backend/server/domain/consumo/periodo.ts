import type { DataISO } from '../tipos.js';

export const PRESETS = ['hoje', '7d', '30d', '90d', 'mes_atual', 'mes_anterior'] as const;
export type Preset = (typeof PRESETS)[number];

/** Data de calendário 'YYYY-MM-DD' do instante `agora` no fuso IANA. */
export function hojeNoFuso(agora: Date, fuso: string): DataISO {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function somarDias(iso: DataISO, dias: number): DataISO {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Todos os dias de `de` a `ate`, inclusive. */
export function diasDoPeriodo(de: DataISO, ate: DataISO): DataISO[] {
  const out: DataISO[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) out.push(d);
  return out;
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/** Offset do fuso (ms) no instante dado: horaLocal - UTC. */
function offsetMs(instante: number, fuso: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
      .formatToParts(new Date(instante))
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return local - instante;
}

/** Epoch (segundos) da meia-noite do dia `iso` no fuso. */
export function inicioDoDiaUnix(iso: DataISO, fuso: string): number {
  const utc = Date.parse(`${iso}T00:00:00Z`);
  // Duas passadas resolvem a virada de horário de verão na borda.
  let t = utc - offsetMs(utc, fuso);
  t = utc - offsetMs(t, fuso);
  return Math.floor(t / 1000);
}

export function presetPeriodo(preset: Preset, agora: Date, fuso: string): { de: DataISO; ate: DataISO } {
  const hoje = hojeNoFuso(agora, fuso);
  const [a, m] = hoje.split('-').map(Number) as [number, number];
  switch (preset) {
    case 'hoje':
      return { de: hoje, ate: hoje };
    case '7d':
      return { de: somarDias(hoje, -6), ate: hoje };
    case '30d':
      return { de: somarDias(hoje, -29), ate: hoje };
    case '90d':
      return { de: somarDias(hoje, -89), ate: hoje };
    case 'mes_atual':
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case 'mes_anterior': {
      const inicio = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
      const fim = new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10);
      return { de: inicio, ate: fim };
    }
  }
}
