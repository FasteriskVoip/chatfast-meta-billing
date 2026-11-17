import { describe, expect, it } from 'vitest';
import { agregarConsumo } from '../../../server/domain/consumo/agregacao.js';
import { entrada, linha } from './consumo.helper.js';

const cat = (r: ReturnType<typeof agregarConsumo>, g: string) => r.categorias.find((c) => c.categoria === g)!;

describe('custo e percentual por categoria', () => {
  it('soma, percentual, cobradas/gratuitas e custo médio por cobrada', () => {
    const r = agregarConsumo(entrada({
      consumo: [
        linha({ categoria: 'MARKETING', volume: 30, custo: '3.000000' }),
        linha({ categoria: 'MARKETING_LITE', volume: 10, custo: '0.500000' }),
        linha({ categoria: 'SERVICE', tipoPreco: 'FREE_CUSTOMER_SERVICE', volume: 60, custo: '0.000000' }),
      ],
    }));
    expect(cat(r, 'MARKETING')).toMatchObject({ volume: 40, percentual: 0.4, cobradas: 40, gratuitas: 0, custoBrl: '3.500000', custoSituacao: 'completo' });
    expect(cat(r, 'SERVICE')).toMatchObject({ volume: 60, cobradas: 0, gratuitas: 60, custoBrl: '0.000000' });
    expect(r.total).toMatchObject({
      volume: 100, categorias: 2, cobradas: 40, custoBrl: '3.500000', custoMedioPorCobradaBrl: '0.087500', custoSituacao: 'completo', diasSemCusto: 0,
    });
  });

  it('custo ausente e sem preço vigente → indisponível com custo null (nunca 0)', () => {
    const r = agregarConsumo(entrada({ consumo: [linha({ data: '2026-09-01', custo: null, semCusto: 1 }), linha({ data: '2026-09-01', categoria: 'UTILITY', custo: null, semCusto: 1 })] }));
    expect(r.total).toMatchObject({ custoBrl: null, custoSituacao: 'indisponivel', custoMedioPorCobradaBrl: null });
    expect(cat(r, 'MARKETING').custoBrl).toBeNull();
  });

  it('período misto → parcial com dias sem custo', () => {
    const r = agregarConsumo(entrada({
      consumo: [linha({ data: '2026-11-01', custo: '2.000000' }), linha({ data: '2026-09-02', custo: null, semCusto: 1 })],
    }));
    expect(r.total).toMatchObject({ custoBrl: '2.000000', custoSituacao: 'parcial', diasSemCusto: 1 });
  });

  it('sem custo da Meta → estima pela tabela de preços em BRL; gratuita custa 0', () => {
    const r = agregarConsumo(entrada({
      consumo: [
        linha({ data: '2026-11-01', categoria: 'MARKETING', volume: 10, custo: null, semCusto: 1 }),
        linha({ data: '2026-11-01', categoria: 'UTILITY', volume: 100, custo: null, semCusto: 1 }),
        linha({ data: '2026-11-01', categoria: 'SERVICE', tipoPreco: 'FREE_CUSTOMER_SERVICE', volume: 50, custo: null, semCusto: 1 }),
      ],
    }));
    expect(cat(r, 'MARKETING').custoBrl).toBe('3.217000');
    expect(cat(r, 'UTILITY').custoBrl).toBe('3.500000');
    expect(cat(r, 'SERVICE').custoBrl).toBe('0.000000');
    expect(r.total).toMatchObject({ custoBrl: '6.717000', custoSituacao: 'completo' });
  });

  it('grupo com linha parcialmente sem custo também é parcial', () => {
    const r = agregarConsumo(entrada({ consumo: [linha({ custo: '1.000000', semCusto: 1 })] }));
    expect(r.total.custoSituacao).toBe('parcial');
  });

  it('USD sem nenhuma cotação → sem_cotacao', () => {
    const r = agregarConsumo(entrada({ consumo: [linha({ moeda: 'USD' })] }));
    expect(r.total).toMatchObject({ custoBrl: null, custoSituacao: 'sem_cotacao' });
  });

  it('dia anterior à primeira cotação → convertido com cotação posterior', () => {
    const r = agregarConsumo(entrada({
      consumo: [linha({ moeda: 'USD', data: '2026-11-01', custo: '2.000000' })],
      cotacoes: [{ valor: '5.5000', vigenteDesde: '2026-11-02' }],
    }));
    expect(r.total).toMatchObject({ custoBrl: '11.000000', convertidoComCotacaoPosterior: true });
  });

  it('categoria OUTRA entra só no total', () => {
    const r = agregarConsumo(entrada({ consumo: [linha({ categoria: 'OUTRA', volume: 5 })] }));
    expect(r.total.volume).toBe(5);
    expect(r.categorias.every((c) => c.volume === 0)).toBe(true);
  });

  it('filtro por grupo restringe as linhas', () => {
    const r = agregarConsumo(entrada({
      grupo: 'UTILITY',
      consumo: [linha({ categoria: 'MARKETING', volume: 30 }), linha({ categoria: 'UTILITY', volume: 7 })],
    }));
    expect(r.total.volume).toBe(7);
  });
});
