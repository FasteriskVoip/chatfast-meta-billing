import { TriangleAlert } from 'lucide-react';

/** Aviso só na tela (sem e-mail/mensagem, FR-048). */
export function FaixaDesatualizado({ desde }: { desde: string | null }) {
  if (!desde) return null;
  const dia = new Date(desde).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return (
    <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-atencao-texto print:hidden">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      Dados desatualizados desde {dia}. A Fasterisk já foi notificada.
    </div>
  );
}
