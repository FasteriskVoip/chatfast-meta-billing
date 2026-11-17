import { describe, expect, it } from 'vitest';
import { converter, cotacaoDoDia, deMicro, dividir, paraMicro } from '../../../server/domain/consumo/cotacao.js';

const cot = [
  { valor: '5.0000', vigenteDesde: '2026-11-01' },
  { valor: '5.8000', vigenteDesde: '2026-11-10' },
];

describe('cotação do dia', () => {
  it('maior vigenteDesde ≤ dia', () => {
    expect(cotacaoDoDia(cot, '2026-11-09')).toEqual({ valorMicro: 5_000_000n, posterior: false });
    expect(cotacaoDoDia(cot, '2026-11-10')).toEqual({ valorMicro: 5_800_000n, posterior: false });
  });

  it('dia antes de todas → a mais antiga, marcada como posterior', () => {
    expect(cotacaoDoDia(cot, '2026-10-01')).toEqual({ valorMicro: 5_000_000n, posterior: true });
  });

  it('sem cotações → null', () => {
    expect(cotacaoDoDia([], '2026-11-01')).toBeNull();
  });
});

describe('converter', () => {
  it('USD pela cotação do dia (o passado não muda com a cotação nova)', () => {
    expect(converter('10.000000', 'USD', '2026-11-05', cot)).toEqual({ brlMicro: 50_000_000n, posterior: false });
    expect(converter('10.000000', 'USD', '2026-11-12', cot)).toEqual({ brlMicro: 58_000_000n, posterior: false });
  });
  it('BRL passa direto', () => {
    expect(converter('3.210000', 'BRL', '2026-11-05', [])).toEqual({ brlMicro: 3_210_000n, posterior: false });
  });
  it('outra moeda → indisponível', () => {
    expect(converter('1', 'EUR', '2026-11-05', cot)).toEqual({ brlMicro: null, motivo: 'moeda' });
  });
  it('USD sem cotação → sem_cotacao', () => {
    expect(converter('1', 'USD', '2026-11-05', [])).toEqual({ brlMicro: null, motivo: 'sem_cotacao' });
  });
  it('custo ausente → sem_custo (nunca zero)', () => {
    expect(converter(null, 'BRL', '2026-11-05', cot)).toEqual({ brlMicro: null, motivo: 'sem_custo' });
  });
});

describe('aritmética decimal', () => {
  it('sem erro de ponto flutuante', () => {
    expect(deMicro(paraMicro('0.1') + paraMicro('0.2'))).toBe('0.300000');
    expect(deMicro(paraMicro('-1.5'))).toBe('-1.500000');
    expect(dividir(10n, 4n)).toBe(3n);
    expect(dividir(10n, 3n)).toBe(3n);
  });
});
