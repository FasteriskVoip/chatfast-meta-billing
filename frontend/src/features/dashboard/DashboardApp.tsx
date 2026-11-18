import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Inbox, Info, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TOM } from '@/components/shared/tons';
import { Vazio } from '@/components/shared/Vazio';
import { CARTAO, atraso } from '@/components/shared/visual';
import { Acesso } from '@/components/shared/Acesso';
import { EsqueletoConteudoDashboard, EsqueletoDashboard, EsqueletoFiltros } from '@/components/shared/Esqueletos';
import { formatarData, formatarDataHora, tempoRelativo } from '@/components/shared/formatos';
import { api, mensagemDeErro, type SessaoAberta } from '@/lib/api';
import { telaPersistida } from '@/lib/telaPersistida';
import { SeletorCliente } from '@/features/admin/SeletorCliente';
import { linkAdmin } from '@/features/admin/tipos';
import { BotaoSincronizar } from './BotaoSincronizar';
import { BotoesExportar } from './BotoesExportar';
import { CardsCategoria } from './CardsCategoria';
import { Destaques } from './Destaques';
import { FaixaDesatualizado } from './FaixaDesatualizado';
import { Filtros } from './Filtros';
import { GraficoCategorias, GraficoCustoPorMensagem, GraficoMensagens } from './Graficos';
import { TabelaNumeros } from './TabelaNumeros';
import { presetPeriodo } from './periodo';
import { NOME_GRUPO, type FiltroAplicado, type Filtros as Opcoes, type Resumo, type Status } from './tipos';
import './print.css';

/** Admin da Fasterisk pode abrir o dashboard de um cliente com ?ver=<companyid>. */
const empresaVista = () => new URLSearchParams(window.location.search).get('ver') ?? undefined;

function DashboardPage({ sessao }: { sessao: SessaoAberta }) {
  const ver = sessao.admin ? empresaVista() : undefined;
  const base = useMemo((): Record<string, string> => (ver ? { companyid: ver } : {}), [ver]);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [aplicado, setAplicado] = telaPersistida<FiltroAplicado | null>('filtros', null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const params = useMemo(() => {
    if (!aplicado) return null;
    const p: Record<string, string> = { ...base, de: aplicado.de, ate: aplicado.ate };
    if (aplicado.contaId) p.contaId = aplicado.contaId;
    if (aplicado.numeroId) p.numeroId = aplicado.numeroId;
    if (aplicado.categoria) p.categoria = aplicado.categoria;
    return p;
  }, [aplicado, base]);

  const carregarStatus = useCallback(async () => {
    const { data } = await api.get<Status>('/dashboard/status', { params: base });
    setStatus(data);
    return data;
  }, [base]);

  const carregarResumo = useCallback(() => {
    if (!params) return;
    setErro(null);
    setAtualizando(true);
    api.get<Resumo>('/dashboard/resumo', { params })
      .then((r) => setResumo(r.data))
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setAtualizando(false));
  }, [params]);

  useEffect(() => {
    api.get<Opcoes>('/dashboard/filtros', { params: base })
      .then(({ data }) => {
        setOpcoes(data);
        // Período padrão: mês atual (US-10).
        setAplicado((a) => a ?? { ...presetPeriodo('mes_atual', new Date(), data.fuso), contaId: '', numeroId: '', categoria: '' });
      })
      .catch((e) => setErro(mensagemDeErro(e)));
    carregarStatus().catch(() => {});
  }, [base, carregarStatus, setAplicado]);

  useEffect(carregarResumo, [carregarResumo]);

  const ultimoSync = status?.ultimoSync ?? resumo?.ultimoSync ?? null;
  const vazio = resumo && resumo.total.volume === 0 && resumo.envio.enviadas === 0;
  /** Categoria aplicada: a tela entra em "modo foco" nela. */
  const foco = aplicado?.categoria || null;
  const antesDoHistorico = aplicado && opcoes?.historicoDesde && aplicado.de < opcoes.historicoDesde;
  const filtrosTexto = aplicado
    ? [
        aplicado.contaId && opcoes?.contas.find((c) => c.id === aplicado.contaId)?.nome,
        aplicado.numeroId && opcoes?.numeros.find((n) => n.id === aplicado.numeroId)?.display,
        aplicado.categoria && NOME_GRUPO[aplicado.categoria],
      ].filter(Boolean).join(' · ') || 'Todos'
    : '';

  return (
    <div className="min-h-screen p-4 sm:p-6 print:min-h-0 print:p-0">
      <main className="mx-auto max-w-7xl space-y-6">
        {/* Só admin: troca de cliente sem voltar ao /admin. Clientes nunca veem esta faixa. */}
        {sessao.admin && (
          <div className="entrar flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 print:hidden">
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <ShieldCheck className="size-4" aria-hidden /> Modo administrador
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span id="seletor-cliente-dash" className="text-xs font-semibold text-blue-700">Cliente</span>
              <SeletorCliente atual={ver} rotuloId="seletor-cliente-dash" />
              <Button asChild variant="outline">
                <a href={linkAdmin()}><ArrowLeft aria-hidden /> Voltar ao admin</a>
              </Button>
            </div>
          </div>
        )}
        <header className={`entrar ${CARTAO} flex flex-wrap items-center gap-4 p-5`}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white print:hidden">
            <BarChart3 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl leading-tight font-bold text-slate-800">Consumo WhatsApp</h1>
            <p className="text-xs text-slate-500">
              Atualizado com a Meta{' '}
              <time dateTime={ultimoSync ?? undefined} title={formatarDataHora(ultimoSync)} className="font-semibold text-slate-600">
                {tempoRelativo(ultimoSync)}
              </time>
            </p>
            {status?.coletandoHistorico && (
              <div className="flex flex-wrap gap-1.5 print:hidden">
                <Badge className={TOM.neutro}>Coletando histórico</Badge>
              </div>
            )}
            {/* Cabeçalho do relatório (só no PDF). */}
            <p className="hidden text-xs print:block">
              {ver ?? sessao.empresa.nome} · {aplicado && `${formatarData(aplicado.de)} a ${formatarData(aplicado.ate)}`} · Filtros: {filtrosTexto} ·
              Custo em R$ estimado
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {params && <BotoesExportar params={params} />}
            <BotaoSincronizar status={status} params={base} onAtualizar={carregarStatus} onConcluido={carregarResumo} />
          </div>
        </header>

        <FaixaDesatualizado desde={status?.desatualizadoDesde ?? null} />

        {!opcoes && !erro && <EsqueletoFiltros />}
        {opcoes && aplicado && (
          <div className="entrar" style={atraso(1)}>
            <Filtros key={JSON.stringify(aplicado)} opcoes={opcoes} valor={aplicado} onAplicar={setAplicado} />
          </div>
        )}

        {antesDoHistorico && (
          <p className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <Info className="size-4 shrink-0" aria-hidden /> Dados disponíveis a partir de {formatarData(opcoes!.historicoDesde!)}.
          </p>
        )}
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {erro}
          </p>
        )}

        {!resumo && !erro && <EsqueletoConteudoDashboard />}
        {resumo && vazio && (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-card">
            {status?.coletandoHistorico ? (
              <Vazio icone={Loader2} texto="Coletando o histórico na Meta. Os dados aparecem aqui em instantes." />
            ) : (
              <Vazio icone={Inbox} texto="Nenhum consumo no período selecionado. Tente um período maior nos filtros." />
            )}
          </section>
        )}
        {atualizando && resumo && (
          <div role="progressbar" aria-label="Atualizando dados" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-blue-100 print:hidden">
            <div className="carregando h-full w-2/5 rounded-full bg-blue-600" />
          </div>
        )}
        {resumo && !vazio && (
          // Enquanto o novo filtro carrega, o conteúdo antigo esmaece em vez de sumir: números e barras deslizam para os novos valores.
          <div aria-busy={atualizando} className={`space-y-6 transition-opacity duration-300 ${atualizando ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="entrar" style={atraso(2)}><Destaques resumo={resumo} foco={foco} /></div>
            <CardsCategoria resumo={resumo} foco={foco} />
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="entrar" style={atraso(3)}><GraficoCategorias resumo={resumo} foco={foco} /></div>
              <div className="entrar" style={atraso(4)}><GraficoMensagens resumo={resumo} foco={foco} /></div>
            </div>
            <div className="entrar" style={atraso(5)}><GraficoCustoPorMensagem resumo={resumo} foco={foco} /></div>
            <div className="entrar" style={atraso(6)}><TabelaNumeros resumo={resumo} foco={foco} /></div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardApp() {
  return <Acesso esqueleto={<EsqueletoDashboard texto="Validando acesso…" />}>{(s) => <DashboardPage sessao={s} />}</Acesso>;
}
