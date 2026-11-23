import { useCallback, useEffect, useState } from 'react';
import { BarChart3, DollarSign, Layers, ShieldX, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Acesso, TelaBloqueio } from '@/components/shared/Acesso';
import { EsqueletoAdmin } from '@/components/shared/Esqueletos';
import { TOM } from '@/components/shared/tons';
import { api, mensagemDeErro, type SessaoAberta } from '@/lib/api';
import { telaPersistida } from '@/lib/telaPersistida';
import { Cotacoes } from './Cotacoes';
import { DetalheCliente } from './DetalheCliente';
import { GruposCusto } from './GruposCusto';
import { ListaClientes } from './ListaClientes';
import { SeletorCliente } from './SeletorCliente';
import type { Painel as DadosPainel } from './tipos';

type Aba = 'clientes' | 'cotacao' | 'grupos';

function Painel({ sessao }: { sessao: SessaoAberta }) {
  const [aba, setAba] = telaPersistida<Aba>('aba', 'clientes');
  const [clienteId, setClienteId] = telaPersistida<string | null>('cliente', null);
  const [painel, setPainel] = useState<DadosPainel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPainel = useCallback(() => {
    api.get<DadosPainel>('/admin/painel').then((r) => setPainel(r.data)).catch((e) => setErro(mensagemDeErro(e)));
  }, []);
  useEffect(carregarPainel, [carregarPainel]);

  const abas = [
    { id: 'clientes' as const, rotulo: 'Clientes', icone: Users, contador: painel?.contasComProblema, pendente: false },
    { id: 'cotacao' as const, rotulo: 'Cotação do dólar', icone: DollarSign, contador: 0, pendente: Boolean(painel?.semCotacao) },
    { id: 'grupos' as const, rotulo: 'Grupos de custo', icone: Layers, contador: 0, pendente: false },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="entrar rounded-2xl border border-slate-200 bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white">
              <BarChart3 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl leading-tight font-bold text-slate-800">Consumo Meta</h1>
              <p className="text-xs text-slate-500">Administração dos clientes, contas WABA e cotação</p>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-wrap gap-1.5 self-center">
                <Badge>Administrador</Badge>
                <Badge className="bg-slate-100 text-slate-500">{sessao.empresa.nome}</Badge>
              </div>
              <div className="grid gap-1">
                <span id="seletor-cliente-admin" className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Ver dashboard de</span>
                <SeletorCliente rotuloId="seletor-cliente-admin" />
              </div>
            </div>
          </div>
          <nav role="tablist" aria-label="Seções do admin" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2">
            {abas.map(({ id, rotulo, icone: Icone, contador, pendente }) => {
              const ativa = aba === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => { setAba(id); if (id === 'clientes') setClienteId(null); }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                    ativa ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Icone className="size-4" aria-hidden />
                  {rotulo}
                  {Boolean(contador) && (
                    <span className="rounded-full bg-erro px-1.5 text-[11px] font-semibold text-white tabular-nums" aria-label={`${contador} conta(s) com problema`}>{contador}</span>
                  )}
                  {pendente && <span className="size-2 rounded-full bg-amber-500" aria-label="Sem cotação cadastrada" />}
                </button>
              );
            })}
          </nav>
        </header>

        {erro && <p role="alert" className="text-sm text-erro-texto">{erro}</p>}

        {aba === 'grupos' ? (
          <GruposCusto />
        ) : aba === 'cotacao' ? (
          painel && <Cotacoes painel={painel} onAlterada={carregarPainel} />
        ) : clienteId ? (
          <DetalheCliente clienteId={clienteId} alertasAtivos={painel?.alertasAtivos ?? false} onVoltar={() => setClienteId(null)} onAlterada={carregarPainel} />
        ) : (
          <ListaClientes painel={painel} onAbrir={setClienteId} />
        )}
      </main>
    </div>
  );
}

export default function AdminApp() {
  return (
    <Acesso esqueleto={<EsqueletoAdmin texto="Validando acesso…" />}>
      {(s) => (s.admin ? <Painel sessao={s} /> : (
        <TelaBloqueio titulo="Área restrita" icone={ShieldX} tom={TOM.neutro} suporte
          texto="Esta área é só para a administração da Fasterisk. O consumo da sua conta está no painel Consumo Meta." />
      ))}
    </Acesso>
  );
}
