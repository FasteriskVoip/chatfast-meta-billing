import { describe, expect, it, vi } from 'vitest';
import { criarSyncService } from '../../server/services/sync.service.js';
import { ConsumoMemoria, RepoMemoria, cifraFake, silencioso } from '../fakes.js';
import { metaFake } from '../app.helper.js';

const AGORA = new Date('2026-11-17T12:00:00Z');
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

function montar(info: { valido: boolean; expiraEm: Date | null; motivo?: string }, status: 'ATIVA' | 'TOKEN_EXPIRANDO' = 'ATIVA') {
  const repo = new RepoMemoria();
  const conta = repo.addConta(repo.addCliente(), { status });
  const meta = metaFake({ validarToken: vi.fn(async () => ({ ...info, escopos: [] })) });
  const svc = criarSyncService({
    repo, consumo: new ConsumoMemoria(), meta, cifra: cifraFake, log: silencioso, serializarErro: () => ({}),
    cfg: { diasBackfill: 3, diasReprocesso: 3 }, agora: () => AGORA,
  });
  return { repo, conta, svc };
}

describe('verificarExpiracoes', () => {
  it('expira em ≤ 7 dias → TOKEN_EXPIRANDO', async () => {
    const { repo, svc } = montar({ valido: true, expiraEm: dias(5) });
    await svc.verificarExpiracoes();
    expect(repo.contas[0]).toMatchObject({ status: 'TOKEN_EXPIRANDO', tokenExpiraEm: dias(5) });
  });

  it('expira em mais de 7 dias → continua ATIVA', async () => {
    const { repo, svc } = montar({ valido: true, expiraEm: dias(30) });
    await svc.verificarExpiracoes();
    expect(repo.contas[0]!.status).toBe('ATIVA');
  });

  it('token renovado sai de TOKEN_EXPIRANDO', async () => {
    const { repo, svc } = montar({ valido: true, expiraEm: null }, 'TOKEN_EXPIRANDO');
    await svc.verificarExpiracoes();
    expect(repo.contas[0]!.status).toBe('ATIVA');
  });

  it('is_valid=false → TOKEN_INVALIDO com desatualizadoDesde', async () => {
    const { repo, svc } = montar({ valido: false, expiraEm: null, motivo: 'revogado' });
    await svc.verificarExpiracoes();
    expect(repo.contas[0]).toMatchObject({ status: 'TOKEN_INVALIDO', desatualizadoDesde: AGORA });
  });
});
