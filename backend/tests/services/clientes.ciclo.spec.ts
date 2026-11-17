import { describe, expect, it, vi } from 'vitest';
import { calcularJanela } from '../../server/domain/sync/janela.js';
import { coletavel } from '../../server/domain/sync/status.js';
import { criarClientesService } from '../../server/services/clientes.service.js';
import { criarSessaoService } from '../../server/services/sessao.service.js';
import { CID_A, RepoMemoria, cifraFake } from '../fakes.js';
import { helenaFake } from '../app.helper.js';

const AGORA = new Date('2026-11-17T15:00:00Z');

function montar(resultado: 'OK' | 'ERRO' = 'OK') {
  const repo = new RepoMemoria();
  const cliente = repo.addCliente({ companyid: CID_A });
  const conta = repo.addConta(cliente);
  const sync = { sincronizarConta: vi.fn(async () => resultado) };
  let pendente: Promise<unknown> = Promise.resolve();
  const svc = criarClientesService({
    repo, helena: helenaFake(), cifra: cifraFake, sync, agora: () => AGORA,
    emSegundoPlano: (p) => { pendente = p(); },
  });
  return { repo, cliente, conta, svc, sync, esperar: () => pendente };
}

describe('desativar e reativar cliente', () => {
  it('desativar: INATIVO, inativoDesde=hoje, tokens mantidos, fora do tick, sessão bloqueada', async () => {
    const { repo, cliente, conta, svc } = montar();
    await svc.atualizar(cliente.id, { status: 'INATIVO' }, 'admin');
    const c = repo.clientes[0]!;
    expect(c).toMatchObject({ status: 'INATIVO', inativoDesde: '2026-11-17', tokenChatfastCifrado: cliente.tokenChatfastCifrado });
    expect(repo.contas[0]!.tokenCifrado).toBe(conta.tokenCifrado);
    expect(coletavel(repo.contas[0]!, c)).toBe(false);
    expect(repo.auditoria[0]!.acao).toBe('cliente.desativar');
    const sessao = criarSessaoService({ repo, helena: helenaFake(), cifra: cifraFake, adminCompanyids: [], emitir: () => ({ token: '', exp: 0 }), cadastrarCliente: svc.criar });
    await expect(sessao.abrir(CID_A, 'x')).rejects.toMatchObject({ codigo: 'CLIENTE_INATIVO' });
  });

  it('reativar: ATIVO, reprocessa desde inativoDesde e limpa após sync OK', async () => {
    const { repo, cliente, conta, svc, sync, esperar } = montar();
    await svc.atualizar(cliente.id, { status: 'INATIVO' }, 'admin');
    repo.clientes[0]!.inativoDesde = '2026-09-01';
    const janela = calcularJanela(repo.contas[0]!, repo.clientes[0]!, '2026-11-17', { diasBackfill: 90, diasReprocesso: 3 });
    expect(janela.de).toBe('2026-09-01');
    await svc.atualizar(cliente.id, { status: 'ATIVO' }, 'admin');
    await esperar();
    expect(sync.sincronizarConta).toHaveBeenCalledWith(conta.id, 'ADMIN');
    expect(repo.clientes[0]).toMatchObject({ status: 'ATIVO', inativoDesde: null });
    expect(repo.auditoria.map((a) => a.acao)).toEqual(['cliente.desativar', 'cliente.reativar']);
  });

  it('reativar com sync falho mantém inativoDesde para o próximo ciclo', async () => {
    const { repo, cliente, svc, esperar } = montar('ERRO');
    await svc.atualizar(cliente.id, { status: 'INATIVO' }, 'admin');
    await svc.atualizar(cliente.id, { status: 'ATIVO' }, 'admin');
    await esperar();
    expect(repo.clientes[0]!.inativoDesde).toBe('2026-11-17');
  });
});
