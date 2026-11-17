import { describe, expect, it } from 'vitest';
import { montarResumo } from '../../../server/domain/consumo/agregacao.js';
import { entrada, linha, msg } from './consumo.helper.js';

describe('séries diárias', () => {
  const r = montarResumo(entrada({
    de: '2026-11-01', ate: '2026-11-03',
    consumo: [
      linha({ data: '2026-11-03', categoria: 'UTILITY', volume: 4, custo: '0.400000' }),
      linha({ data: '2026-11-01', categoria: 'MARKETING', volume: 9, custo: null, semCusto: 1 }),
    ],
    mensagens: [msg({ data: '2026-11-02', enviadas: 5, entregues: 6 })],
  }));

  it('todos os dias, em ordem crescente, inclusive zerados', () => {
    expect(r.serieCategorias.map((s) => s.data)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(r.serieMensagens.map((s) => s.data)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });

  it('volume e custo por grupo em cada dia (sem custo da Meta usa a estimativa)', () => {
    expect(r.serieCategorias[0]!.MARKETING).toEqual({ volume: 9, custoBrl: '2.895300' });
    expect(r.serieCategorias[1]!.MARKETING).toEqual({ volume: 0, custoBrl: '0.000000' });
    expect(r.serieCategorias[2]!.UTILITY).toEqual({ volume: 4, custoBrl: '0.400000' });
  });

  it('enviadas/entregues por dia (entregues pode passar de enviadas)', () => {
    expect(r.serieMensagens[1]).toEqual({ data: '2026-11-02', enviadas: 5, entregues: 6 });
  });
});
