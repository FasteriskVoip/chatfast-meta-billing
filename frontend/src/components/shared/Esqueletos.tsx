import { BarChart3, DollarSign, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CARTAO } from './visual';

/**
 * Carregamento progressivo: a estrutura real da página (cabeçalho, título) aparece na hora, com blocos no
 * formato exato do conteúdo. Usado enquanto o código baixa, enquanto a sessão é validada e enquanto os dados
 * chegam, para a tela ir se preenchendo no lugar, sem tela branca nem pulo de layout.
 */

const Bloco = ({ className }: { className: string }) => <Skeleton className={`rounded-2xl ${className}`} />;

/** Conteúdo do dashboard (destaques, categorias, gráficos, tabela). Também usado depois do login, até o resumo chegar. */
export function EsqueletoConteudoDashboard() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Bloco className="h-56" />
        <Bloco className="h-56" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Bloco key={i} className="h-44" />)}</div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Bloco className="h-80" />
        <Bloco className="h-80" />
      </div>
      <Bloco className="h-64" />
    </div>
  );
}

/** Filtros do dashboard (até as opções chegarem). */
export const EsqueletoFiltros = () => <Bloco className="h-36" />;

function Logo() {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white">
      <BarChart3 className="size-5" aria-hidden />
    </span>
  );
}

/** Aviso só para leitor de tela: o visual já mostra que está carregando. */
const Status = ({ texto }: { texto: string }) => <p role="status" className="sr-only">{texto}</p>;

export function EsqueletoDashboard({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="min-h-screen p-4 sm:p-6">
      <main className="mx-auto max-w-7xl space-y-6" aria-busy="true">
        <Status texto={texto} />
        <header className={`${CARTAO} flex flex-wrap items-center gap-4 p-5`}>
          <Logo />
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl leading-tight font-bold text-slate-800">Consumo WhatsApp</h1>
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-9 w-52 rounded-full" />
          </div>
        </header>
        <EsqueletoFiltros />
        <EsqueletoConteudoDashboard />
      </main>
    </div>
  );
}

export function EsqueletoAdmin({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="min-h-screen p-4 sm:p-6">
      <main className="mx-auto max-w-6xl space-y-6" aria-busy="true">
        <Status texto={texto} />
        <header className={CARTAO}>
          <div className="flex flex-wrap items-center gap-3 p-5">
            <Logo />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl leading-tight font-bold text-slate-800">Consumo Meta</h1>
              <p className="text-xs text-slate-500">Administração dos clientes, contas WABA e cotação</p>
            </div>
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="flex gap-1 border-t border-slate-100 px-4 py-2 text-sm font-medium text-slate-400" aria-hidden>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5"><Users className="size-4" /> Clientes</span>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5"><DollarSign className="size-4" /> Cotação do dólar</span>
          </div>
        </header>
        <Bloco className="h-28" />
        <div className={`${CARTAO} space-y-3 p-5`} aria-hidden>
          <div className="flex justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-72" />
          </div>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </main>
    </div>
  );
}
