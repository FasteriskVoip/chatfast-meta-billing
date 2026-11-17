import { describe, expect, it, vi } from 'vitest';
import type { Agente, HelenaGateway } from '../../server/domain/ports/HelenaGateway.js';
import { ErroIndisponivel, ErroToken } from '../../server/domain/ports/erros.js';
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
  const svc = criarSessaoService({
    repo, helena: h, cifra: cifraFake, adminCompanyids: [CID_FASTERISK],
    emitir: (d) => ({ token: `tok:${d.cid}:${d.uid}:${d.admin}`, exp: 0 }),
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

  it('empresa não cadastrada → SEM_CADASTRO', async () => {
    const { svc } = montar();
    expect(await codigo(svc.abrir('99999999-9999-4999-8999-999999999999', 'agente-1'))).toBe('SEM_CADASTRO');
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
