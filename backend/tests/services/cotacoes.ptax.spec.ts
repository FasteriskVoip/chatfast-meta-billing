import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { criarPtaxGateway } from '../../server/adapters/bcb/ptaxGateway.js';
import type { FonteCotacao } from '../../server/domain/ports/FonteCotacao.js';
import { AUTOR_PTAX, criarCotacoesService } from '../../server/services/cotacoes.service.js';
import { RepoMemoria } from '../fakes.js';

// 2026-11-18 12:00 em Fortaleza
const AGORA = new Date('2026-11-18T15:00:00Z');

describe('PTAX do Banco Central (adapter)', () => {
  it('lê o formato real da API: um valor por dia útil, 4 casas, último boletim do dia', async () => {
    const get = vi.fn(async () => ({
      data: {
        value: [
          { cotacaoVenda: 5.584, dataHoraCotacao: '2026-11-13 13:03:27.375047' },
          { cotacaoVenda: 5.7324, dataHoraCotacao: '2026-11-16 10:00:00.0' },
          { cotacaoVenda: 5.73241, dataHoraCotacao: '2026-11-16 13:06:32.509132' },
        ],
      },
    }));
    const r = await criarPtaxGateway({ get } as unknown as AxiosInstance).dolarVenda('2026-11-13', '2026-11-18');
    expect(r).toEqual([{ data: '2026-11-13', valor: '5.5840' }, { data: '2026-11-16', valor: '5.7324' }]);
    expect(get).toHaveBeenCalledWith(expect.stringContaining('CotacaoDolarPeriodo'), expect.objectContaining({
      params: expect.objectContaining({ '@dataInicial': "'11-13-2026'", '@dataFinalCotacao': "'11-18-2026'" }),
    }));
  });

  it('API fora do ar → erro de indisponível (o ciclo só registra e segue)', async () => {
    const get = vi.fn(async () => { throw new Error('ECONNRESET'); });
    await expect(criarPtaxGateway({ get } as unknown as AxiosInstance).dolarVenda('2026-11-13', '2026-11-18'))
      .rejects.toMatchObject({ name: 'ErroIndisponivel' });
  });
});

describe('cotacoes.sincronizarOficial', () => {
  function montar(dias: { data: string; valor: string }[]) {
    const repo = new RepoMemoria();
    const dolarVenda = vi.fn<FonteCotacao['dolarVenda']>(async (de, ate) => dias.filter((x) => x.data >= de && x.data <= ate));
    const svc = criarCotacoesService({ repo, fonte: { dolarVenda }, diasHistorico: 90, agora: () => AGORA });
    return { repo, svc, dolarVenda };
  }

  it('primeira vez: traz o histórico (diasHistorico) e grava como Banco Central', async () => {
    const { repo, svc, dolarVenda } = montar([{ data: '2026-11-17', valor: '5.7851' }, { data: '2026-11-18', valor: '5.8102' }]);
    expect(await svc.sincronizarOficial()).toBe(2);
    expect(dolarVenda).toHaveBeenCalledWith('2026-08-20', '2026-11-18');
    expect(repo.cotacoes.map((c) => [c.vigenteDesde, c.valor, c.criadoPor])).toEqual(
      expect.arrayContaining([['2026-11-17', '5.7851', AUTOR_PTAX], ['2026-11-18', '5.8102', AUTOR_PTAX]]),
    );
  });

  it('depois: busca só a partir da última PTAX gravada e não duplica', async () => {
    const { repo, svc, dolarVenda } = montar([{ data: '2026-11-17', valor: '5.7851' }, { data: '2026-11-18', valor: '5.8102' }]);
    repo.cotacoes.push({ id: 'p', valor: '5.7851', vigenteDesde: '2026-11-17', criadoPor: AUTOR_PTAX, criadoEm: new Date() });
    expect(await svc.sincronizarOficial()).toBe(1);
    expect(dolarVenda).toHaveBeenCalledWith('2026-11-17', '2026-11-18');
    expect(await svc.sincronizarOficial()).toBe(0);
  });

  it('nunca sobrescreve uma cotação cadastrada à mão na mesma data', async () => {
    const { repo, svc } = montar([{ data: '2026-11-18', valor: '5.8102' }]);
    repo.cotacoes.push({ id: 'm', valor: '6.1000', vigenteDesde: '2026-11-18', criadoPor: 'uid-admin', criadoEm: new Date() });
    expect(await svc.sincronizarOficial()).toBe(0);
    expect(repo.cotacoes.find((c) => c.vigenteDesde === '2026-11-18')).toMatchObject({ valor: '6.1000', criadoPor: 'uid-admin' });
  });

  it('sem fonte (COTACAO_AUTOMATICA=false): não faz nada', async () => {
    const svc = criarCotacoesService({ repo: new RepoMemoria() });
    expect(await svc.sincronizarOficial()).toBe(0);
  });
});
