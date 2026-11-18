import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Campo rotulado com ajuda em linguagem simples e erro por campo (o backend devolve "campo: mensagem"). */
export function Campo({
  id, rotulo, ajuda, erro, children, ...input
}: { id: string; rotulo: string; ajuda?: string; erro?: string | null; children?: ReactNode } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{rotulo}</Label>
        {ajuda && (
          <Tooltip>
            <TooltipTrigger type="button" aria-label={`Ajuda: ${rotulo}`} className="rounded-full text-slate-400 hover:text-blue-600">
              <CircleHelp className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{ajuda}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Input id={id} aria-invalid={Boolean(erro)} {...input} />
      {children}
      {erro && <p className="text-xs text-erro-texto">{erro}</p>}
    </div>
  );
}

/** "tokenChatfast: recusado" → { campo: 'tokenChatfast', texto }. */
export function erroDoCampo(mensagem: string | null, campo: string) {
  if (!mensagem) return null;
  return mensagem.startsWith(`${campo}:`) ? mensagem.slice(campo.length + 1).trim() : null;
}

/** Chave liga/desliga com rótulo e explicação curta. */
export function CampoChave({ id, rotulo, descricao, checked, onChange, disabled }: {
  id: string; rotulo: string; descricao: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-card px-3 py-2.5">
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" aria-describedby={`${id}-desc`} />
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-semibold text-slate-800">{rotulo}</label>
        <p id={`${id}-desc`} className="text-xs text-slate-500">{descricao}</p>
      </div>
    </div>
  );
}
