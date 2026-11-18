import { describe, expect, it } from 'vitest';
import { chavePeriodo, excedeuLimite } from '../../../server/domain/consumo/alertas.js';

describe('alerta de consumo', () => {
  it('dispara quando o custo chega ou passa do limite', () => {
    expect(excedeuLimite('200.00', '199.99')).toBe(false);
    expect(excedeuLimite('200.00', '200.00')).toBe(true);
    expect(excedeuLimite('200.00', '231.45')).toBe(true);
  });

  it('sem limite ou com custo ausente nunca dispara (ausente não é zero)', () => {
    expect(excedeuLimite(null, '999.00')).toBe(false);
    expect(excedeuLimite('0.01', null)).toBe(false);
  });

  it('chave do período: o dia, ou o 1º dia do mês', () => {
    expect(chavePeriodo('diario', '2026-11-18')).toBe('2026-11-18');
    expect(chavePeriodo('mensal', '2026-11-18')).toBe('2026-11-01');
  });
});
