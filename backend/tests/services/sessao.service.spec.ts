import { describe, expect, it, vi } from 'vitest';
import type { Agente, HelenaGateway } from '../../server/domain/ports/HelenaGateway.js';
import { ErroIndisponivel, ErroToken } from '../../server/domain/ports/erros.js';
import { criarClientesService } from '../../server/services/clientes.service.js';
import { criarSessaoService } from '../../server/services/sessao.service.js';
import { CID_A, CID_FASTERISK, RepoMemoria, cifraFake } from '../fakes.js';

const agente: Agente = { id: 'agente-1', userId: 'user-1', nome: 'Ana', isOwner: false, profile: 'AGENT' };

function montar(helena: Partial<HelenaGateway> = {}) {
  const repo = new RepoMemoria();
  const cliente = repo.addCliente({ companyid: CID_A });
  const h: HelenaGateway = {
    obterAgente: vi.fn(async (_t, id) => (id === agente.id ? agente : null)),
    listarAgentes: vi.fn(async () => [agente]),
    ...helena,
  };
  const clientes = criarClientesService({ repo, helena: h, cifra: cifraFake, sync: { sincronizarConta: async () => 'OK' }, emSegundoPlano: () => {} });
  const svc = criarSessaoService({
    repo, helena: h, cifra: cifraFake, adminCompanyids: [CID_FASTERISK],
    emitir: (d) => ({ token: `tok:${d.cid}:${d.uid}:${d.admin}`, exp: 0 }),
    cadastrarCliente: clientes.criar,
  });
  return { svc, repo, cliente, h };
}

const codigo = (p: Promise<unknown>) => p.then(() => 'ok', (e: { codigo?: string }) => e.codigo);

describe('sessao.service.abrir', () => {
  it('sem companyid ou user_id → SEM_USUARIO', async () => {
    const { svc } = montar();
    expect(await codigo(svc.abrir(undefined, 'x'))).toBe('SEM_USUARIO');
    expect(await codigo(svc.abrir(CID_A, undefined))).toBe('SEM_USUARIO');
    expect(await codigo(svc.abrir('nao-uuid', 'x'))).toBe('SEM_USUARIO');
  });

  it('empresa não cadastrada → SEM_CADASTRO; só a empresa admin recebe podeCadastrar', async () => {
    const { svc } = montar();
    await expect(svc.abrir('99999999-9999-4999-8999-999999999999', 'agente-1'))
      .rejects.toMatchObject({ codigo: 'SEM_CADASTRO', extra: { podeCadastrar: false } });
    await expect(svc.abrir(CID_FASTERISK, 'agente-1')).rejects.toMatchObject({ codigo: 'SEM_CADASTRO', extra: { podeCadastrar: true } });
  });

  it('cliente inativo → CLIENTE_INATIVO', async () => {
    const { svc, cliente } = montar();
    cliente.status = 'INATIVO';
    expect(await codigo(svc.abrir(CID_A, 'agente-1'))).toBe('CLIENTE_INATIVO');
  });

  it('agente encontrado direto → sessão emitida, usando o token Chatfast decifrado', async () => {
    const { svc, h } = montar();
    const s = await svc.abrir(CID_A, 'agente-1');
    expect(s).toMatchObject({ token: `tok:${CID_A}:agente-1:false`, nome: 'Ana', admin: false, empresa: { nome: 'Empresa Teste' } });
    expect(h.obterAgente).toHaveBeenCalledWith('chatfast-token-1234', 'agente-1');
  });

  it('agente só na lista (por userId) → ok', async () => {
    const { svc, h } = montar();
    const s = await svc.abrir(CID_A, 'user-1');
    expect(s.nome).toBe('Ana');
    expect(h.listarAgentes).toHaveBeenCalled();
  });

  it('agente desconhecido → AGENTE_DESCONHECIDO', async () => {
    const { svc } = montar();
    expect(await codigo(svc.abrir(CID_A, 'intruso'))).toBe('AGENTE_DESCONHECIDO');
  });

  it('Helena fora do ar → HELENA_INDISPONIVEL e não libera', async () => {
    const { svc } = montar({ obterAgente: vi.fn(async () => { throw new ErroIndisponivel(); }) });
    expect(await codigo(svc.abrir(CID_A, 'agente-1'))).toBe('HELENA_INDISPONIVEL');
  });

  it('Helena recusa o token → HELENA_RECUSOU_TOKEN e marca alerta no cliente', async () => {
    const { svc, cliente } = montar({ obterAgente: vi.fn(async () => { throw new ErroToken('recusado', 401); }) });
    expect(await codigo(svc.abrir(CID_A, 'agente-1'))).toBe('HELENA_RECUSOU_TOKEN');
    expect(cliente.alertaChatfast).toBe(true);
  });

  it('cache curto evita a segunda chamada à Helena', async () => {
    const { svc, h } = montar();
    await svc.abrir(CID_A, 'agente-1');
    await svc.abrir(CID_A, 'agente-1');
    expect(h.obterAgente).toHaveBeenCalledTimes(1);
  });
});

describe('sessao.service.primeiroAcesso', () => {
  const admin: Agente = { id: 'adm-1', userId: 'u-adm', nome: 'Bia', isOwner: false, profile: 'ADMIN' };
  const dados = { nome: 'Fasterisk', tokenChatfast: 'token-fasterisk-9876' };
  const comAdmin = () => montar({
    obterAgente: vi.fn(async (_t, id) => [agente, admin].find((a) => a.id === id) ?? null),
    listarAgentes: vi.fn(async () => [agente, admin]),
  });

  it('empresa fora de ADMIN_COMPANYIDS não se cadastra pela tela', async () => {
    const { svc, repo } = comAdmin();
    expect(await codigo(svc.primeiroAcesso('99999999-9999-4999-8999-999999999999', 'adm-1', dados))).toBe('SEM_PERMISSAO');
    expect(repo.clientes).toHaveLength(1);
  });

  it('agente comum da empresa admin não cadastra', async () => {
    const { svc, repo } = comAdmin();
    expect(await codigo(svc.primeiroAcesso(CID_FASTERISK, 'agente-1', dados))).toBe('SEM_PERMISSAO');
    expect(repo.clientes).toHaveLength(1);
  });

  it('token recusado pela Helena → VALIDACAO, sem cadastro', async () => {
    const { svc, repo } = montar({ obterAgente: vi.fn(async () => { throw new ErroToken('recusado', 401); }) });
    expect(await codigo(svc.primeiroAcesso(CID_FASTERISK, 'adm-1', dados))).toBe('VALIDACAO');
    expect(repo.clientes).toHaveLength(1);
  });

  it('nome ou token vazios → VALIDACAO', async () => {
    const { svc } = comAdmin();
    expect(await codigo(svc.primeiroAcesso(CID_FASTERISK, 'adm-1', { nome: ' ', tokenChatfast: 'x' }))).toBe('VALIDACAO');
  });

  it('admin da empresa admin cadastra (token cifrado) e já sai com sessão de admin', async () => {
    const { svc, repo } = comAdmin();
    const s = await svc.primeiroAcesso(CID_FASTERISK, 'adm-1', dados);
    expect(s).toMatchObject({ admin: true, nome: 'Bia', empresa: { nome: 'Fasterisk' } });
    const c = repo.clientes.find((x) => x.companyid === CID_FASTERISK)!;
    expect(c.tokenChatfastCifrado).not.toBe(dados.tokenChatfast);
    expect(c.tokenChatfastUltimos4).toBe('9876');
  });

  it('segunda tentativa → DUPLICADO', async () => {
    const { svc } = comAdmin();
    await svc.primeiroAcesso(CID_FASTERISK, 'adm-1', dados);
    expect(await codigo(svc.primeiroAcesso(CID_FASTERISK, 'adm-1', dados))).toBe('DUPLICADO');
  });
});
