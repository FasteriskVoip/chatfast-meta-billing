import { describe, expect, it, vi } from 'vitest';
import { criarContasService } from '../../server/services/contas.service.js';
import { CID_A, RepoMemoria, cifraFake } from '../fakes.js';
import { metaFake } from '../app.helper.js';

const TOKEN = 'EAAG-novo-token-ABCD';

function montar(meta = metaFake()) {
  const repo = new RepoMemoria();
  const cliente = repo.addCliente({ companyid: CID_A });
  const sync = { sincronizarConta: vi.fn(async () => 'OK' as const) };
  const svc = criarContasService({ repo, meta, cifra: cifraFake, sync, emSegundoPlano: (p) => void p() });
  return { repo, cliente, svc, sync, meta };
}

describe('contas.service.criar', () => {
  it('WABA duplicada → DUPLICADO', async () => {
    const { repo, cliente, svc } = montar();
    repo.addConta(cliente, { wabaId: '123456789' });
    await expect(svc.criar(cliente.id, { wabaId: '123456789', token: TOKEN }, 'u')).rejects.toMatchObject({ codigo: 'DUPLICADO' });
  });

  it('salva o token sem validar (não chama debug_token)', async () => {
    const meta = metaFake({ validarToken: vi.fn(async () => ({ valido: false, expiraEm: null, escopos: [], motivo: 'x' })) });
    const { repo, cliente, svc } = montar(meta);
    await svc.criar(cliente.id, { wabaId: '123456789', token: TOKEN }, 'u');
    expect(meta.validarToken).not.toHaveBeenCalled();
    expect(repo.contas[0]).toMatchObject({ tokenExpiraEm: null });
  });

  it('Meta recusa WABA/números no cadastro → salva com padrão e dispara a sync', async () => {
    const falha = vi.fn(async () => { throw new Error('Meta recusou a chamada (400/100): x'); });
    const { repo, cliente, svc, sync } = montar(metaFake({ obterWaba: falha, listarNumeros: falha }));
    await svc.criar(cliente.id, { wabaId: '123456789', token: TOKEN }, 'u');
    expect(repo.contas[0]).toMatchObject({ nome: '123456789', moeda: 'USD' });
    expect(sync.sincronizarConta).toHaveBeenCalled();
  });

  it('sucesso: grava moeda, fuso, expiração, ultimos4, números, backfill pendente, auditoria sem token e dispara o backfill', async () => {
    const expira = new Date('2027-01-01T00:00:00Z');
    const meta = metaFake({
      validarToken: vi.fn(async () => ({ valido: true, expiraEm: expira, escopos: ['whatsapp_business_management'] })),
      obterWaba: vi.fn(async () => ({ nome: 'WABA X', moeda: 'BRL', fusoMeta: '42' })),
      listarNumeros: vi.fn(async () => [{ phoneNumberId: 'p1', display: '+55 61 3399-3888', verifiedName: 'X', qualidade: 'GREEN' as const }]),
    });
    const { repo, cliente, svc, sync } = montar(meta);
    const v = await svc.criar(cliente.id, { wabaId: '123456789', token: TOKEN }, 'admin-1');
    const conta = repo.contas[0]!;
    expect(conta).toMatchObject({ moeda: 'BRL', fuso: 'America/Fortaleza', tokenExpiraEm: null, tokenUltimos4: 'ABCD', historicoDesde: null, nome: 'WABA X' });
    expect(conta.tokenCifrado).toBe(cifraFake.cifrar(TOKEN));
    expect(v.numeros).toHaveLength(1);
    expect(JSON.stringify(v)).not.toContain(TOKEN);
    expect(repo.auditoria[0]).toMatchObject({ acao: 'conta.criar', userId: 'admin-1', dados: { token: { ultimos4: 'ABCD' } } });
    expect(JSON.stringify(repo.auditoria)).not.toContain(TOKEN);
    expect(sync.sincronizarConta).toHaveBeenCalledWith(conta.id, 'ADMIN');
  });
});
