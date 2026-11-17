import { describe, expect, it } from 'vitest';
import { ehCobrada, grupoDaCategoria } from '../../../server/domain/consumo/categorias.js';

describe('categorias', () => {
  it.each([
    ['MARKETING', 'MARKETING'], ['MARKETING_LITE', 'MARKETING'], ['UTILITY', 'UTILITY'],
    ['AUTHENTICATION', 'AUTHENTICATION'], ['AUTHENTICATION_INTERNATIONAL', 'AUTHENTICATION'],
    ['SERVICE', 'SERVICE'], ['REFERRAL_CONVERSION', 'SERVICE'], ['OUTRA', null],
  ] as const)('%s → %s', (meta, grupo) => {
    expect(grupoDaCategoria(meta)).toBe(grupo);
  });

  it('REGULAR é cobrada; FREE_* e OUTRO não', () => {
    expect(ehCobrada('REGULAR')).toBe(true);
    expect(ehCobrada('FREE_CUSTOMER_SERVICE')).toBe(false);
    expect(ehCobrada('FREE_ENTRY_POINT')).toBe(false);
    expect(ehCobrada('OUTRO')).toBe(false);
  });
});
