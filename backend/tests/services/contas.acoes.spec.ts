import { describe, expect, it, vi } from 'vitest';
import { criarContasService } from '../../server/services/contas.service.js';
import { RepoMemoria, cifraFake } from '../fakes.js';
import { metaFake } from '../app.helper.js';

const AGORA = new Date('2026-11-17T12:00:00Z');
const NOVO = 'EAAG-token-novo-7777';

function montar(meta = metaFake()) {
  const repo = new RepoMemoria();
  const conta = repo.addConta(repo.addCliente());
  const sync = { sincronizarConta: vi.fn(async () => 'OK' as const) };
  const svc = criarContasService({ repo, meta, cifra: cifraFake, sync, emSegundoPlano: (p) => void p(), agora: () => AGORA });
  return { repo, conta, svc, sync, meta };
}

describe('ações de conta (admin)', () => {
  it('trocar token não chama a validação da Meta', async () => {
    const { conta, svc, meta } = montar();
    await svc.atualizar(conta.id, { token: NOVO }, 'u');
    expect(meta.validarToken).not.toHaveBeenCalled();
  });

  it('trocar token válido → ATIVA, limpa faixa, audita {ultimos4}', async () => {
    const { repo, conta, svc } = montar();
    Object.assign(repo.contas[0]!, { status: 'TOKEN_INVALIDO', desatualizadoDesde: new Date(), ultimoErro: 'x' });
    const v = await svc.atualizar(conta.id, { token: NOVO }, 'admin-1');
    expect(repo.contas[0]).toMatchObject({ status: 'ATIVA', desatualizadoDesde: null, ultimoErro: null, tokenUltimos4: '7777' });
    expect(JSON.stringify(v)).not.toContain(NOVO);
    expect(repo.auditoria[0]).toMatchObject({ acao: 'conta.trocar_token', dados: { token: { ultimos4: '7777' } } });
  });

  it('pausar marca desatualizado; retomar volta a ATIVA', async () => {
    const { repo, conta, svc } = montar();
    await svc.atualizar(conta.id, { pausada: true }, 'u');
    expect(repo.contas[0]).toMatchObject({ status: 'PAUSADA', desatualizadoDesde: AGORA });
    await svc.atualizar(conta.id, { pausada: false }, 'u');
    expect(repo.contas[0]).toMatchObject({ status: 'ATIVA', desatualizadoDesde: null });
    expect(repo.auditoria.map((a) => a.acao)).toEqual(['conta.pausar', 'conta.retomar']);
  });

  it('testar não grava nada e reporta o problema', async () => {
    const { repo, conta, svc } = montar(metaFake({ validarToken: vi.fn(async () => ({ valido: false, expiraEm: null, escopos: [], motivo: 'revogado' })) }));
    expect(await svc.testar(conta.id)).toMatchObject({ ok: false, problema: 'revogado' });
    expect(repo.auditoria).toHaveLength(0);
    expect(repo.execucoes).toHaveLength(0);
  });

  it('sincronizar como admin ignora os 15 min mas respeita o lock', async () => {
    const { repo, conta, svc, sync } = montar();
    repo.contas[0]!.ultimoSyncEm = new Date();
    expect(await svc.sincronizarAgora(conta.id)).toEqual({ iniciado: true });
    expect(sync.sincronizarConta).toHaveBeenCalledWith(conta.id, 'ADMIN');
    repo.contas[0]!.syncEmAndamentoDesde = new Date();
    await expect(svc.sincronizarAgora(conta.id)).rejects.toMatchObject({ codigo: 'SYNC_EM_ANDAMENTO' });
  });

  it('atualizar números marca os sumidos', async () => {
    const meta = metaFake({ listarNumeros: vi.fn(async () => [{ phoneNumberId: 'p1', display: '+1', verifiedName: null, qualidade: 'RED' as const }]) });
    const { repo, conta, svc } = montar(meta);
    repo.addNumero(conta, { phoneNumberId: 'p1' });
    repo.addNumero(conta, { phoneNumberId: 'p2' });
    const ns = await svc.atualizarNumeros(conta.id, 'u');
    expect(ns.find((n) => n.qualidade === 'RED')).toBeTruthy();
    expect(repo.numeros.find((n) => n.phoneNumberId === 'p2')!.naoEncontradoNaMeta).toBe(true);
  });

  it('alternar número muda coleta e audita', async () => {
    const { repo, conta, svc } = montar();
    const n = repo.addNumero(conta);
    await svc.alternarNumero(n.id, false, 'u');
    expect(repo.numeros[0]!.coletaAtiva).toBe(false);
    expect(repo.auditoria[0]!.acao).toBe('numero.desativar');
  });
});
