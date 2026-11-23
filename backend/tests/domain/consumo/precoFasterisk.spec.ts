import { describe, expect, it } from 'vitest';
import { agregarConsumo } from '../../../server/domain/consumo/agregacao.js';
import { aplicarPrecoFasterisk } from '../../../server/domain/consumo/precos.js';
import { entrada, linha } from './consumo.helper.js';

describe('preço Fasterisk (cliente Taxi)', () => {
  it('cobra preço × cobradas, grátis custa 0 e custo ausente da Meta não importa', () => {
    const consumo = aplicarPrecoFasterisk([
      linha({ categoria: 'UTILITY', volume: 100, custo: null, semCusto: 1, moeda: 'USD' }),
      linha({ categoria: 'MARKETING', volume: 10, custo: '9.000000' }),
      linha({ categoria: 'SERVICE', tipoPreco: 'FREE_CUSTOMER_SERVICE', volume: 50, custo: null }),
    ], '0.06');
    const r = agregarConsumo(entrada({ consumo }));
    expect(r.total).toMatchObject({ cobradas: 110, custoBrl: '6.600000', custoMedioPorCobradaBrl: '0.060000', custoSituacao: 'completo' });
  });
});
