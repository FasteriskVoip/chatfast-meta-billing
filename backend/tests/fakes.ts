import { randomUUID } from 'node:crypto';
import type { Cifra } from '../server/domain/ports/Cifra.js';
import type {
  ClienteRegistro, ConsumoRepository, ContaRegistro, ContaRepository, CotacaoRegistro, ExecucaoRegistro, GrupoCustoRegistro,
  LinhaConsumoNova, LinhaMensagensNova, NovaAuditoria, NumeroRegistro,
} from '../server/domain/ports/repositorios.js';

/** Cifra de teste reversível e óbvia (não é segurança: só para conferir que o token não vaza). */
export const cifraFake: Cifra = {
  cifrar: (t) => `cifrado(${t})`,
  decifrar: (c) => c.replace(/^cifrado\((.*)\)$/, '$1'),
};

export const silencioso = { info() {}, warn() {}, error() {} };

export const CID_A = '11111111-1111-4111-8111-111111111111';
export const CID_B = '22222222-2222-4222-8222-222222222222';
export const GRUPO_STANDARD = '00000000-0000-0000-0000-000000000001';
export const CID_FASTERISK = '00000000-0000-4000-8000-00000000fa57';

/** Repositório de cadastro em memória com o mesmo contrato do Prisma. */
export class RepoMemoria implements ContaRepository {
  clientes: ClienteRegistro[] = [];
  contas: ContaRegistro[] = [];
  numeros: NumeroRegistro[] = [];
  execucoes: (ExecucaoRegistro & { contaWabaId: string })[] = [];
  cotacoes: CotacaoRegistro[] = [];
  grupos: GrupoCustoRegistro[] = [{ id: GRUPO_STANDARD, nome: 'Standard', precoBrl: '0.0600' }];
  auditoria: NovaAuditoria[] = [];
  lockAgora = Date.now;

  addCliente(p: Partial<ClienteRegistro> = {}): ClienteRegistro {
    const c: ClienteRegistro = {
      id: randomUUID(), companyid: CID_A, nome: 'Empresa Teste', status: 'ATIVO',
      tokenChatfastCifrado: cifraFake.cifrar('chatfast-token-1234'), tokenChatfastUltimos4: '1234',
      inativoDesde: null, alertaChatfast: false, taxi: false, grupoCustoId: GRUPO_STANDARD,
      limiteDiarioBrl: null, limiteMensalBrl: null, alertaDiarioEm: null, alertaMensalEm: null, ...p,
    };
    this.clientes.push(c);
    return c;
  }

  addConta(cliente: ClienteRegistro, p: Partial<ContaRegistro> = {}): ContaRegistro {
    const c: ContaRegistro = {
      id: randomUUID(), clienteId: cliente.id, companyid: cliente.companyid, wabaId: String(Math.floor(Math.random() * 1e12)),
      nome: 'WABA Teste', tokenCifrado: cifraFake.cifrar('EAAG-meta-token-9999'), tokenUltimos4: '9999', tokenExpiraEm: null,
      moeda: 'USD', fuso: 'America/Fortaleza', status: 'ATIVA', semCustoMeta: false, historicoDesde: '2026-01-01',
      ultimoSyncEm: null, ultimoErro: null, desatualizadoDesde: null, syncEmAndamentoDesde: null, ...p,
    };
    this.contas.push(c);
    return c;
  }

  addNumero(conta: ContaRegistro, p: Partial<NumeroRegistro> = {}): NumeroRegistro {
    const n: NumeroRegistro = {
      id: randomUUID(), contaWabaId: conta.id, companyid: conta.companyid, phoneNumberId: randomUUID(),
      display: '+55 61 3399-3888', verifiedName: 'Empresa Teste', qualidade: 'GREEN', coletaAtiva: true,
      naoEncontradoNaMeta: false, ...p,
    };
    this.numeros.push(n);
    return n;
  }

  async clientePorCompanyid(companyid: string) { return this.clientes.find((c) => c.companyid === companyid) ?? null; }
  async clientePorId(id: string) { return this.clientes.find((c) => c.id === id) ?? null; }
  async listarClientes() { return [...this.clientes]; }
  async criarCliente(d: Parameters<ContaRepository['criarCliente']>[0]) {
    return this.addCliente({ ...d, status: 'ATIVO', inativoDesde: null, alertaChatfast: false });
  }
  async atualizarCliente(id: string, patch: Partial<ClienteRegistro>) {
    const c = this.clientes.find((x) => x.id === id)!;
    Object.assign(c, patch);
    return { ...c };
  }

  async todasContas() { return this.contas.map((c) => ({ ...c })); }
  async contasDoCliente(clienteId: string) { return this.contas.filter((c) => c.clienteId === clienteId).map((c) => ({ ...c })); }
  async contasDaEmpresa(companyid: string) { return this.contas.filter((c) => c.companyid === companyid).map((c) => ({ ...c })); }
  async contaPorId(id: string) { const c = this.contas.find((x) => x.id === id); return c ? { ...c } : null; }
  async contaPorWabaId(wabaId: string) { return this.contas.find((x) => x.wabaId === wabaId) ?? null; }
  async criarConta(d: Parameters<ContaRepository['criarConta']>[0], numeros: Parameters<ContaRepository['criarConta']>[1]) {
    const cliente = this.clientes.find((c) => c.id === d.clienteId)!;
    const conta = this.addConta(cliente, { ...d, historicoDesde: null });
    for (const n of numeros) {
      this.addNumero(conta, { phoneNumberId: n.phoneNumberId, display: n.display, verifiedName: n.verifiedName, qualidade: n.qualidade });
    }
    return { ...conta };
  }
  async atualizarConta(id: string, patch: Partial<ContaRegistro>) {
    const c = this.contas.find((x) => x.id === id)!;
    Object.assign(c, patch);
    return { ...c };
  }
  async adquirirLock(contaId: string) {
    const c = this.contas.find((x) => x.id === contaId)!;
    const agora = this.lockAgora();
    if (c.syncEmAndamentoDesde && agora - c.syncEmAndamentoDesde.getTime() < 30 * 60_000) return false;
    c.syncEmAndamentoDesde = new Date(agora);
    return true;
  }
  async liberarLock(contaId: string) { this.contas.find((x) => x.id === contaId)!.syncEmAndamentoDesde = null; }

  async numerosDaConta(contaId: string) { return this.numeros.filter((n) => n.contaWabaId === contaId).map((n) => ({ ...n })); }
  async numerosDaEmpresa(companyid: string) { return this.numeros.filter((n) => n.companyid === companyid).map((n) => ({ ...n })); }
  async numeroPorId(id: string) { return this.numeros.find((n) => n.id === id) ?? null; }
  async sincronizarNumeros(conta: ContaRegistro, numeros: Parameters<ContaRepository['sincronizarNumeros']>[1]) {
    for (const m of numeros) {
      const n = this.numeros.find((x) => x.phoneNumberId === m.phoneNumberId);
      if (n) Object.assign(n, { display: m.display, verifiedName: m.verifiedName, qualidade: m.qualidade, naoEncontradoNaMeta: false });
      else this.addNumero(conta, { phoneNumberId: m.phoneNumberId, display: m.display, verifiedName: m.verifiedName, qualidade: m.qualidade });
    }
    const ids = new Set(numeros.map((n) => n.phoneNumberId));
    for (const n of this.numeros) if (n.contaWabaId === conta.id && !ids.has(n.phoneNumberId)) n.naoEncontradoNaMeta = true;
    return this.numerosDaConta(conta.id);
  }
  async atualizarNumero(id: string, patch: { coletaAtiva: boolean }) {
    const n = this.numeros.find((x) => x.id === id)!;
    Object.assign(n, patch);
    return { ...n };
  }

  async iniciarExecucao(d: Parameters<ContaRepository['iniciarExecucao']>[0]) {
    const id = randomUUID();
    this.execucoes.push({ id, contaWabaId: d.contaWabaId, origem: d.origem, status: d.status, inicio: new Date(), fim: null,
      janelaDe: d.janelaDe, janelaAte: d.janelaAte, linhas: 0, erro: null });
    return id;
  }
  async finalizarExecucao(id: string, d: Parameters<ContaRepository['finalizarExecucao']>[1]) {
    Object.assign(this.execucoes.find((e) => e.id === id)!, d, { fim: new Date() });
  }
  async listarExecucoes(contaId: string, limite: number) {
    return this.execucoes.filter((e) => e.contaWabaId === contaId).slice(-limite).reverse();
  }

  async listarCotacoes() { return [...this.cotacoes].sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde)); }
  async salvarCotacao(d: { valor: string; vigenteDesde: string; criadoPor: string }) {
    const existente = this.cotacoes.find((c) => c.vigenteDesde === d.vigenteDesde);
    if (existente) {
      Object.assign(existente, { valor: Number(d.valor).toFixed(4), criadoPor: d.criadoPor });
      return { cotacao: { ...existente }, substituiu: true };
    }
    const c = { id: randomUUID(), valor: Number(d.valor).toFixed(4), vigenteDesde: d.vigenteDesde, criadoPor: d.criadoPor, criadoEm: new Date() };
    this.cotacoes.push(c);
    return { cotacao: { ...c }, substituiu: false };
  }

  async listarGruposCusto() { return [...this.grupos]; }
  async salvarGrupoCusto({ id, ...d }: { id?: string; nome: string; precoBrl: string }) {
    const g = id ? Object.assign(this.grupos.find((x) => x.id === id)!, d) : { id: randomUUID(), ...d };
    if (!id) this.grupos.push(g);
    return { ...g };
  }
  async registrarAuditoria(d: NovaAuditoria) { this.auditoria.push(d); }
}

/** Fatos em memória com upsert pela chave natural e agregação igual à SQL. */
export class ConsumoMemoria implements ConsumoRepository {
  consumo = new Map<string, LinhaConsumoNova>();
  mensagens = new Map<string, LinhaMensagensNova>();

  async upsertConsumo(linhas: LinhaConsumoNova[]) {
    for (const l of linhas) this.consumo.set([l.numeroId, l.data, l.categoria, l.tipoPreco, l.pais, l.tier].join('|'), { ...l });
    return linhas.length;
  }
  async upsertMensagens(linhas: LinhaMensagensNova[]) {
    for (const l of linhas) this.mensagens.set(`${l.numeroId}|${l.data}`, { ...l });
    return linhas.length;
  }
  private filtra<T extends { companyid: string; data: string; contaWabaId: string; numeroId: string }>(
    ls: Iterable<T>, f: Parameters<ConsumoRepository['consumoAgregado']>[0],
  ) {
    return [...ls].filter((l) => l.companyid === f.companyid && l.data >= f.de && l.data <= f.ate
      && (!f.contaId || l.contaWabaId === f.contaId) && (!f.numeroId || l.numeroId === f.numeroId));
  }
  async consumoAgregado(f: Parameters<ConsumoRepository['consumoAgregado']>[0]) {
    const grupos = new Map<string, { l: LinhaConsumoNova; volume: number; custos: (string | null)[] }>();
    for (const l of this.filtra(this.consumo.values(), f)) {
      const k = [l.data, l.numeroId, l.contaWabaId, l.categoria, l.tipoPreco, l.moeda].join('|');
      const g = grupos.get(k) ?? { l, volume: 0, custos: [] };
      g.volume += l.volume;
      g.custos.push(l.custo);
      grupos.set(k, g);
    }
    return [...grupos.values()].map(({ l, volume, custos }) => {
      const informados = custos.filter((c): c is string => c !== null);
      return {
        data: l.data, numeroId: l.numeroId, contaId: l.contaWabaId, categoria: l.categoria, tipoPreco: l.tipoPreco, moeda: l.moeda,
        volume, custo: informados.length ? informados.reduce((a, b) => a + Number(b), 0).toFixed(6) : null,
        semCusto: custos.length - informados.length,
      };
    });
  }
  async mensagensAgregadas(f: Parameters<ConsumoRepository['mensagensAgregadas']>[0]) {
    return this.filtra(this.mensagens.values(), f).map((l) => ({ data: l.data, numeroId: l.numeroId, enviadas: l.enviadas, entregues: l.entregues }));
  }
}
