import { describe, expect, it } from 'vitest';
import { diasDoPeriodo, hojeNoFuso, presetPeriodo } from '../../../server/domain/consumo/periodo.js';

const F = 'America/Fortaleza';
// 2026-11-17 12:00 em Fortaleza (UTC-3)
const AGORA = new Date('2026-11-17T15:00:00Z');

describe('presets de período no fuso da conta', () => {
  it('hoje é só o dia corrente no fuso da conta', () => {
    expect(presetPeriodo('hoje', AGORA, F)).toEqual({ de: '2026-11-17', ate: '2026-11-17' });
    // 23:30 em Fortaleza já é dia 18 em UTC: continua sendo o dia 17 da conta.
    expect(presetPeriodo('hoje', new Date('2026-11-18T02:30:00Z'), F)).toEqual({ de: '2026-11-17', ate: '2026-11-17' });
  });

  it('7d, 30d, 90d terminam hoje', () => {
    expect(presetPeriodo('7d', AGORA, F)).toEqual({ de: '2026-11-11', ate: '2026-11-17' });
    expect(presetPeriodo('30d', AGORA, F)).toEqual({ de: '2026-10-19', ate: '2026-11-17' });
    expect(presetPeriodo('90d', AGORA, F)).toEqual({ de: '2026-08-20', ate: '2026-11-17' });
  });

  it('mês atual e mês anterior', () => {
    expect(presetPeriodo('mes_atual', AGORA, F)).toEqual({ de: '2026-11-01', ate: '2026-11-17' });
    expect(presetPeriodo('mes_anterior', AGORA, F)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  it('borda de meia-noite: 23:59 local ainda é o dia anterior; 00:01 já é o novo', () => {
    expect(hojeNoFuso(new Date('2026-11-18T02:59:00Z'), F)).toBe('2026-11-17');
    expect(hojeNoFuso(new Date('2026-11-18T03:01:00Z'), F)).toBe('2026-11-18');
  });

  it('virada de ano no mês anterior e fevereiro', () => {
    expect(presetPeriodo('mes_anterior', new Date('2027-01-05T15:00:00Z'), F)).toEqual({ de: '2026-12-01', ate: '2026-12-31' });
    expect(presetPeriodo('mes_anterior', new Date('2028-03-10T15:00:00Z'), F)).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
    expect(presetPeriodo('mes_atual', new Date('2027-01-01T02:00:00Z'), F)).toEqual({ de: '2026-12-01', ate: '2026-12-31' });
  });

  it('diasDoPeriodo inclusivo', () => {
    expect(diasDoPeriodo('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});
