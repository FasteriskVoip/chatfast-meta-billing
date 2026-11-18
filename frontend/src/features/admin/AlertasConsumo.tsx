import { useState } from 'react';
import { BellRing, Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatarBRL, formatarData } from '@/components/shared/formatos';
import { PILULA, TituloCartao } from '@/components/shared/visual';
import { Campo, erroDoCampo } from './Formulario';
import type { ClienteDetalhe } from './tipos';

type Limites = { limiteDiarioBrl: string | null; limiteMensalBrl: string | null };

/** "1500.5" ↔ "1500,50": o campo mostra vírgula; a API aceita os dois. Vazio = sem alerta (null). */
const paraCampo = (v: string | null) => (v === null ? '' : Number(v).toFixed(2).replace('.', ','));
const paraApi = (v: string) => (v.trim() === '' ? null : v.trim());

/**
 * Limites de consumo do cliente em R$. Quando o custo do dia ou do mês passa do limite, o backend
 * aciona o webhook do n8n (N8N_WEBHOOK_ALERTAS) uma vez no período.
 */
export function AlertasConsumo({ cliente, alertasAtivos, onSalvar }: {
  cliente: ClienteDetalhe; alertasAtivos: boolean; onSalvar: (p: Limites) => Promise<string | null>;
}) {
  const [f, setF] = useState({ diario: paraCampo(cliente.limiteDiarioBrl), mensal: paraCampo(cliente.limiteMensalBrl) });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const alterado = f.diario !== paraCampo(cliente.limiteDiarioBrl) || f.mensal !== paraCampo(cliente.limiteMensalBrl);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(await onSalvar({ limiteDiarioBrl: paraApi(f.diario), limiteMensalBrl: paraApi(f.mensal) }));
    setSalvando(false);
  }

  const enviado = (limite: string | null, em: string | null) =>
    limite === null ? 'Sem alerta' : `Avisa ao passar de ${formatarBRL(limite)}${em ? ` · último alerta em ${formatarData(em)}` : ''}`;

  return (
    <form onSubmit={salvar} className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <TituloCartao icone={BellRing} titulo="Alertas de consumo"
        descricao="Quando o custo estimado do cliente passar do limite, o n8n é avisado uma vez no dia ou no mês. Deixe vazio para não alertar." />

      {!cliente.taxi && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-atencao-texto">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Alertas só valem para clientes Taxi. Ative "Cliente Taxi" acima: até lá, os limites ficam salvos, mas nenhum alerta é enviado.
        </p>
      )}
      {!alertasAtivos && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-atencao-texto">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          O webhook do n8n não está configurado (variável N8N_WEBHOOK_ALERTAS). Os limites ficam salvos, mas nenhum alerta é enviado.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="limite-diario" rotulo="Limite por dia (R$)" inputMode="decimal" placeholder="Ex.: 200,00" value={f.diario}
          ajuda="Custo estimado do dia, no fuso da conta. O alerta sai uma vez por dia."
          erro={erroDoCampo(erro, 'limiteDiarioBrl')} onChange={(e) => setF({ ...f, diario: e.target.value })}>
          <p className="text-xs text-slate-400">{enviado(cliente.limiteDiarioBrl, cliente.alertaDiarioEm)}</p>
        </Campo>
        <Campo id="limite-mensal" rotulo="Limite por mês (R$)" inputMode="decimal" placeholder="Ex.: 3000,00" value={f.mensal}
          ajuda="Custo estimado do dia 1 até hoje. O alerta sai uma vez por mês."
          erro={erroDoCampo(erro, 'limiteMensalBrl')} onChange={(e) => setF({ ...f, mensal: e.target.value })}>
          <p className="text-xs text-slate-400">{enviado(cliente.limiteMensalBrl, cliente.alertaMensalEm)}</p>
        </Campo>
      </div>

      {erro && !erroDoCampo(erro, 'limiteDiarioBrl') && !erroDoCampo(erro, 'limiteMensalBrl') && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" className={PILULA} disabled={!alterado || salvando}><Check aria-hidden /> {salvando ? 'Salvando…' : 'Salvar limites'}</Button>
      </div>
    </form>
  );
}
