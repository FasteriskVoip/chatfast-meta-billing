import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Botão primário em pílula (assinatura do design system). */
export const PILULA = 'h-9 rounded-full px-4 active:scale-[0.97]';

/** Cartão padrão: rounded-2xl, borda cinza-200, sombra leve. */
export const CARTAO = 'rounded-2xl border border-slate-200 bg-card shadow-sm';

/** Entrada em cascata (com a classe .entrar): cada cartão entra 60ms depois do anterior. */
export const atraso = (ordem: number) => ({ animationDelay: `${ordem * 60}ms` });

/** Título de cartão: ícone 16px primary + texto base semibold, com descrição opcional. */
export function TituloCartao({ icone: Icone, titulo, descricao }: { icone: LucideIcon; titulo: ReactNode; descricao?: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
        <Icone className="size-4 shrink-0 text-blue-600" aria-hidden />
        {titulo}
      </h2>
      {descricao && <p className="text-xs text-slate-400">{descricao}</p>}
    </div>
  );
}

const semMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Contador que anima até o valor (700ms, ease-out); pula a animação com prefers-reduced-motion. */
export function useContagem(alvo: number, ms = 700) {
  const [valor, setValor] = useState(semMovimento() ? alvo : 0);
  const de = useRef(0);
  useEffect(() => {
    if (semMovimento()) return setValor(alvo);
    const inicio = performance.now();
    const origem = de.current;
    let quadro = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / ms);
      const atual = origem + (alvo - origem) * (1 - (1 - p) ** 3);
      setValor(atual);
      de.current = atual;
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ms]);
  return valor;
}

/** KPI: ícone em quadrado 32px com fundo 50, eyebrow uppercase, valor animado e detalhe. */
export function Kpi({ icone: Icone, tom, rotulo, valor, formatar, detalhe, corValor = 'text-slate-800' }: {
  icone: LucideIcon; tom: string; rotulo: string; valor: number | null; formatar: (n: number) => string; detalhe: ReactNode; corValor?: string;
}) {
  const animado = useContagem(valor ?? 0);
  return (
    <div className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:gap-3 sm:p-5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tom}`}><Icone className="size-4" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{rotulo}</p>
        <p className={`text-2xl font-semibold tabular-nums ${corValor}`}>
          {valor === null ? '—' : formatar(animado)}
          <span className="sr-only"> ({valor === null ? 'indisponível' : formatar(valor)})</span>
        </p>
        <p className="text-xs text-slate-500">{detalhe}</p>
      </div>
    </div>
  );
}

/** Segmented control: trilho cinza-100, opção ativa em branco com texto primary. */
export function Segmentado<T extends string>({ opcoes, valor, onChange, rotulo }: {
  opcoes: readonly (readonly [T, string])[]; valor: T | null; onChange: (v: T) => void; rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex max-w-full overflow-x-auto rounded-full bg-slate-100 p-1 [scrollbar-width:none] print:hidden">
      {opcoes.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === valor}
          onClick={() => onChange(v)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
            v === valor ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}
