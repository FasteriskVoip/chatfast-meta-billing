// Cópia da regra de backend/server/domain/consumo/periodo.ts: o monorepo não compartilha código.
export const PRESETS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7d' },
  { id: '30d', rotulo: '30d' },
  { id: '90d', rotulo: '90d' },
  { id: 'mes_atual', rotulo: 'Mês atual' },
  { id: 'mes_anterior', rotulo: 'Mês anterior' },
] as const;
export type Preset = (typeof PRESETS)[number]['id'];

export const hojeNoFuso = (agora: Date, fuso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);

function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function presetPeriodo(preset: Preset, agora: Date, fuso: string): { de: string; ate: string } {
  const hoje = hojeNoFuso(agora, fuso);
  const [a, m] = hoje.split('-').map(Number) as [number, number];
  switch (preset) {
    case 'hoje': return { de: hoje, ate: hoje };
    case '7d': return { de: somarDias(hoje, -6), ate: hoje };
    case '30d': return { de: somarDias(hoje, -29), ate: hoje };
    case '90d': return { de: somarDias(hoje, -89), ate: hoje };
    case 'mes_atual': return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case 'mes_anterior':
      return {
        de: new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10),
        ate: new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10),
      };
  }
}
