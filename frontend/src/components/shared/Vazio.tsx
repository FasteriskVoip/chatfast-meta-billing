import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Estado vazio: nunca deixar área em branco sem explicação. */
export function Vazio({ icone: Icone, texto, children }: { icone: LucideIcon; texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-slate-100">
        <Icone className="size-6 text-slate-400" aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-slate-500">{texto}</p>
      {children}
    </div>
  );
}
