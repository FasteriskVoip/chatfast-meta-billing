import { describe, expect, it } from 'vitest';
import { calcularJanela } from '../../../server/domain/sync/janela.js';

const cfg = { diasBackfill: 90, diasReprocesso: 3 };
const fuso = 'America/Fortaleza';
const HOJE = '2026-11-17';

describe('calcularJanela', () => {
  it('sem histórico → backfill de N dias até hoje', () => {
    expect(calcularJanela({ historicoDesde: null, fuso }, { inativoDesde: null }, HOJE, cfg)).toMatchObject({ de: '2026-08-20', ate: HOJE });
  });

  it('backfill limitado a 365 dias', () => {
    const j = calcularJanela({ historicoDesde: null, fuso }, { inativoDesde: null }, HOJE, { ...cfg, diasBackfill: 1000 });
    expect(j.de).toBe('2025-11-18');
  });

  it('com histórico → últimos N dias (reprocesso)', () => {
    expect(calcularJanela({ historicoDesde: '2026-01-01', fuso }, { inativoDesde: null }, HOJE, cfg).de).toBe('2026-11-15');
  });

  it('cliente reativado → desde inativoDesde', () => {
    expect(calcularJanela({ historicoDesde: '2026-01-01', fuso }, { inativoDesde: '2026-10-01' }, HOJE, cfg).de).toBe('2026-10-01');
  });

  it('reativação também respeita 1 ano', () => {
    expect(calcularJanela({ historicoDesde: '2024-01-01', fuso }, { inativoDesde: '2024-06-01' }, HOJE, cfg).de).toBe('2025-11-18');
  });

  it('unix: meia-noite no fuso da conta, fim exclusivo no dia seguinte', () => {
    const j = calcularJanela({ historicoDesde: '2026-01-01', fuso }, { inativoDesde: null }, HOJE, { ...cfg, diasReprocesso: 1 });
    // 2026-11-17 00:00 em Fortaleza (UTC-3) = 03:00 UTC
    expect(j.inicioUnix).toBe(Date.UTC(2026, 10, 17, 3) / 1000);
    expect(j.fimUnix - j.inicioUnix).toBe(86_400);
  });
});
