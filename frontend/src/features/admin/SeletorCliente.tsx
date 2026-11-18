import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { linkVerDashboard, type ClienteLinha } from './tipos';

/** Escolhe um cliente e abre o dashboard dele (visão de admin). Usado no topo do /admin e na faixa de admin do dashboard. */
export function SeletorCliente({ atual, rotuloId }: { atual?: string; rotuloId: string }) {
  const [clientes, setClientes] = useState<ClienteLinha[]>([]);
  useEffect(() => {
    api.get<ClienteLinha[]>('/admin/clientes').then((r) => setClientes(r.data)).catch(() => {});
  }, []);
  if (!clientes.length) return null;
  // Na própria conta (sem ?ver=) ou num companyid fora da lista, o seletor fica no placeholder.
  const valor = clientes.some((c) => c.companyid === atual) ? atual : '';

  return (
    <Select value={valor} onValueChange={(companyid) => companyid !== atual && window.location.assign(linkVerDashboard(companyid))}>
      <SelectTrigger aria-labelledby={rotuloId} className="w-64 max-w-full bg-card">
        <SelectValue placeholder="Escolha um cliente" />
      </SelectTrigger>
      <SelectContent>
        {clientes.map((c) => (
          <SelectItem key={c.id} value={c.companyid}>
            {c.nome}
            {c.status === 'INATIVO' && <span className="text-xs text-slate-400">(inativo)</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
