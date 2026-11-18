import { describe, expect, it, vi } from 'vitest';
import { ErroToken } from '../../server/domain/ports/erros.js';
import { criarClientesService } from '../../server/services/clientes.service.js';
import { CID_A, RepoMemoria, cifraFake } from '../fakes.js';
import { helenaFake } from '../app.helper.js';

const TOKEN = 'chatfast-token-XYZW';

function montar(helena = helenaFake()) {
  const repo = new RepoMemoria();
  const sync = { sincronizarConta: vi.fn(async () => 'OK' as const) };
  const svc = criarClientesService({ repo, helena, cifra: cifraFake, sync, emSegundoPlano: (p) => void p() });
  return { repo, svc, sync };
}

describe('clientes.service', () => {
  it('cria ATIVO, cifra o token e audita sem o token', async () => {
    const { repo, svc } = montar();
    const c = await svc.criar({ nome: ' Clínica X ', companyid: CID_A.toUpperCase(), tokenChatfast: TOKEN }, 'admin-1');
    expect(c).toMatchObject({ nome: 'Clínica X', companyid: CID_A, status: 'ATIVO', tokenChatfastUltimos4: 'XYZW' });
    expect(JSON.stringify(c)).not.toContain(TOKEN);
    expect(repo.clientes[0]!.tokenChatfastCifrado).toBe(cifraFake.cifrar(TOKEN));
    expect(repo.auditoria[0]).toMatchObject({ acao: 'cliente.criar', dados: { tokenChatfast: { ultimos4: 'XYZW' } } });
  });

  it('companyid duplicado → DUPLICADO', async () => {
    const { repo, svc } = montar();
    repo.addCliente({ companyid: CID_A });
    await expect(svc.criar({ nome: 'X', companyid: CID_A, tokenChatfast: TOKEN }, 'u')).rejects.toMatchObject({ codigo: 'DUPLICADO' });
  });

  it('token Chatfast recusado pela Helena → VALIDACAO', async () => {
    const helena = helenaFake();
    helena.listarAgentes = vi.fn(async () => { throw new ErroToken('x', 401); });
    const { svc } = montar(helena);
    await expect(svc.criar({ nome: 'X', companyid: CID_A, tokenChatfast: TOKEN }, 'u')).rejects.toMatchObject({ codigo: 'VALIDACAO' });
  });

  it('trocar o token audita {ultimos4} e limpa o alerta do Chatfast', async () => {
    const { repo, svc } = montar();
    const c = repo.addCliente({ alertaChatfast: true });
    await svc.atualizar(c.id, { tokenChatfast: 'novo-token-chatfast-9876' }, 'admin-1');
    expect(repo.clientes[0]).toMatchObject({ tokenChatfastUltimos4: '9876', alertaChatfast: false });
    expect(repo.auditoria.at(-1)).toMatchObject({ acao: 'cliente.trocar_token_chatfast', dados: { tokenChatfast: { ultimos4: '9876' } } });
  });

  it('listar: pior status, alerta e nenhum token', async () => {
    const { repo, svc } = montar();
    const c = repo.addCliente();
    repo.addConta(c, { status: 'ATIVA' });
    repo.addConta(c, { status: 'TOKEN_INVALIDO' });
    const [x] = await svc.listar();
    expect(x).toMatchObject({ contas: 2, piorStatus: 'TOKEN_INVALIDO', alerta: true });
    expect(JSON.stringify(x)).not.toMatch(/cifrado/);
  });

  it('painel: conta com problema e sem cotação', async () => {
    const { repo, svc } = montar();
    const c = repo.addCliente();
    repo.addConta(c, { status: 'ERRO_SYNC' });
    repo.addConta(c, { status: 'PAUSADA' });
    expect(await svc.painel()).toEqual({ contasComProblema: 1, cotacaoVigente: null, semCotacao: true, alertasAtivos: false, cotacaoAutomatica: false });
  });
});
