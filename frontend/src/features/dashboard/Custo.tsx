import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatarBRL } from '@/components/shared/formatos';
import { useContagem } from '@/components/shared/visual';
import type { SituacaoCusto } from './tipos';

const EXPLICA: Record<Exclude<SituacaoCusto, 'completo'>, string> = {
  parcial: 'Parte do período não tem custo informado pela Meta; o valor soma só os dias com custo.',
  indisponivel: 'A Meta não informa custo para esta conta (ex.: linha de crédito de parceiro).',
  sem_cotacao: 'Indisponível: cotação USD→BRL não cadastrada.',
};

/** Custo em R$ com a situação explicada. Ausente vira "—" com tooltip, nunca R$ 0,00. */
export function Custo({ valor, situacao, diasSemCusto }: { valor: string | null; situacao: SituacaoCusto; diasSemCusto?: number }) {
  // Conta até o valor; ausente continua "—" (nunca anima de R$ 0,00).
  const animado = useContagem(valor === null ? 0 : Number(valor));
  const exibido = valor === null ? formatarBRL(null) : formatarBRL(animado.toFixed(2));
  if (situacao === 'completo') return <span className="tabular-nums">{exibido}</span>;
  const texto =
    situacao === 'parcial' && diasSemCusto !== undefined
      ? `Custo parcial (${diasSemCusto} ${diasSemCusto === 1 ? 'dia' : 'dias'} sem custo)`
      : EXPLICA[situacao];
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 tabular-nums">
        {exibido}
        <Info className="size-3 text-muted-foreground" aria-hidden />
        <span className="sr-only">{texto}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{texto}</TooltipContent>
    </Tooltip>
  );
}
