import { describe, expect, it } from 'vitest';
import { criarCotacoesService } from '../../server/services/cotacoes.service.js';
import { CID_FASTERISK, RepoMemoria } from '../fakes.js';

const autor = { uid: 'admin-1', cid: CID_FASTERISK };

describe('cotacoes.service', () => {
  it('valor precisa ser > 0 com até 4 casas', async () => {
    const svc = criarCotacoesService({ repo: new RepoMemoria() });
    for (const valor of ['0', '-1', '5.12345', 'abc']) {
      await expect(svc.criar({ valor, vigenteDesde: '2026-11-01' }, autor)).rejects.toMatchObject({ codigo: 'VALIDACAO' });
    }
  });

  it('cria e audita com autor; mesma vigência substitui', async () => {
    const repo = new RepoMemoria();
    const svc = criarCotacoesService({ repo });
    await svc.criar({ valor: '5.43', vigenteDesde: '2026-11-01' }, autor);
    await svc.criar({ valor: '5.50', vigenteDesde: '2026-11-01' }, autor);
    expect(repo.cotacoes).toHaveLength(1);
    expect(repo.cotacoes[0]!.valor).toBe('5.5000');
    expect(repo.auditoria.map((a) => a.acao)).toEqual(['cotacao.criar', 'cotacao.substituir']);
    expect(repo.auditoria[0]).toMatchObject({ userId: 'admin-1' });
  });

  it('lista da mais nova para a mais antiga', async () => {
    const repo = new RepoMemoria();
    const svc = criarCotacoesService({ repo });
    await svc.criar({ valor: '5', vigenteDesde: '2026-10-01' }, autor);
    await svc.criar({ valor: '6', vigenteDesde: '2026-11-01' }, autor);
    expect((await svc.listar()).map((c) => c.vigenteDesde)).toEqual(['2026-11-01', '2026-10-01']);
  });
});
