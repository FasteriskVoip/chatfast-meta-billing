import { describe, expect, it } from 'vitest';
import { agregarEnvio, montarResumo } from '../../../server/domain/consumo/agregacao.js';
import { entrada, msg } from './consumo.helper.js';

describe('agregarEnvio', () => {
  it('totais, não entregues, taxa, média por dia com envio e pico', () => {
    const { envio } = agregarEnvio(
      [
        msg({ data: '2026-11-01', enviadas: 100, entregues: 98 }),
        msg({ data: '2026-11-01', numeroId: 'n2', enviadas: 50, entregues: 50 }),
        msg({ data: '2026-11-03', enviadas: 30, entregues: 29 }),
      ],
      '2026-11-01', '2026-11-03',
    );
    expect(envio).toEqual({
      enviadas: 180, entregues: 177, naoEntregues: 3, taxaEntrega: 177 / 180, mediaDiaria: 90, diasComEnvio: 2, diasNoPeriodo: 3,
      pico: { data: '2026-11-01', enviadas: 150 },
    });
  });

  it('sem envio: taxa null (sem divisão por zero), média 0, sem pico', () => {
    expect(agregarEnvio([], '2026-11-01', '2026-11-02').envio).toMatchObject({ enviadas: 0, taxaEntrega: null, mediaDiaria: 0, pico: null });
  });

  it('ignora linhas fora do período', () => {
    expect(agregarEnvio([msg({ data: '2026-10-31', enviadas: 9 })], '2026-11-01', '2026-11-01').envio.enviadas).toBe(0);
  });

  it('incluiHoje no fuso da conta', () => {
    expect(montarResumo(entrada({ de: '2026-11-01', ate: '2026-11-17', hoje: '2026-11-17' })).periodo.incluiHoje).toBe(true);
    expect(montarResumo(entrada({ de: '2026-10-01', ate: '2026-10-31', hoje: '2026-11-17' })).periodo.incluiHoje).toBe(false);
  });
});
