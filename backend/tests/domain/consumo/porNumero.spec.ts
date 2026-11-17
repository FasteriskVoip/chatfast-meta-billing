import { describe, expect, it } from 'vitest';
import { montarResumo } from '../../../server/domain/consumo/agregacao.js';
import { entrada, linha, msg } from './consumo.helper.js';

describe('consumo por número', () => {
  it('inclui número sem consumo, taxa e volume por grupo; % pelo custo', () => {
    const r = montarResumo(entrada({
      consumo: [
        linha({ numeroId: 'n1', categoria: 'MARKETING', volume: 30, custo: '3.000000' }),
        linha({ numeroId: 'n1', categoria: 'SERVICE', tipoPreco: 'FREE_CUSTOMER_SERVICE', volume: 10, custo: '0.000000' }),
      ],
      mensagens: [msg({ numeroId: 'n1', enviadas: 40, entregues: 39 })],
    }));
    const [n1, n2] = r.porNumero;
    expect(n1).toMatchObject({
      numeroId: 'n1', qualidade: 'GREEN', enviadas: 40, entregues: 39, taxaEntrega: 39 / 40,
      porCategoria: { MARKETING: 30, UTILITY: 0, AUTHENTICATION: 0, SERVICE: 10 }, custoBrl: '3.000000', percentualDoTotal: 1,
    });
    expect(n2).toMatchObject({ numeroId: 'n2', enviadas: 0, taxaEntrega: null, custoBrl: null, percentualDoTotal: 0 });
  });

  it('% soma 1 entre números com custo', () => {
    const r = montarResumo(entrada({
      consumo: [linha({ numeroId: 'n1', custo: '3.000000' }), linha({ numeroId: 'n2', custo: '1.000000' })],
    }));
    expect(r.porNumero.map((n) => n.percentualDoTotal)).toEqual([0.75, 0.25]);
  });

  it('sem custo, % pelo volume', () => {
    const r = montarResumo(entrada({
      consumo: [linha({ numeroId: 'n1', volume: 1, custo: null, semCusto: 1 }), linha({ numeroId: 'n2', volume: 3, custo: null, semCusto: 1 })],
    }));
    expect(r.porNumero.map((n) => n.percentualDoTotal)).toEqual([0.25, 0.75]);
  });
});
