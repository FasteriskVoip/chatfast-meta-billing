import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PILULA, Segmentado } from '@/components/shared/visual';
import { api, mensagemDeErro } from '@/lib/api';
import { Campo } from './Formulario';

/** Mês corrente em 'AAAA-MM' (o backend limita ao fuso da Fasterisk). */
export const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' }).slice(0, 7);

/** Relatório do admin: Excel com o consumo e o custo de todos os clientes no mês escolhido. */
export function RelatorioClientes() {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(mesAtual());
  const [baixando, setBaixando] = useState(false);
  const [segmento, setSegmento] = useState<'todos' | 'taxi' | 'outros'>('todos');

  async function baixar(e: React.FormEvent) {
    e.preventDefault();
    setBaixando(true);
    try {
      const taxi = segmento === 'todos' ? undefined : String(segmento === 'taxi');
      const r = await api.get<Blob>('/admin/relatorio.xlsx', { params: { mes, taxi }, responseType: 'blob' });
      const nome = /filename="([^"]+)"/.exec(String(r.headers['content-disposition']))?.[1] ?? `consumo-clientes-${mes}.xlsx`;
      const url = URL.createObjectURL(r.data);
      Object.assign(document.createElement('a'), { href: url, download: nome }).click();
      URL.revokeObjectURL(url);
      setAberto(false);
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <FileSpreadsheet className="text-emerald-600" aria-hidden /> Relatório
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><FileSpreadsheet aria-hidden /> Relatório de todos os clientes</DialogTitle>
            <DialogDescription>
              Uma planilha com mensagens, cobradas, gratuitas e custo estimado em R$ de cada cliente no mês, com o total.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={baixar} className="space-y-4">
            <Campo id="relatorio-mes" rotulo="Mês" type="month" required value={mes} max={mesAtual()}
              ajuda="No mês corrente, o relatório vai do dia 1 até hoje." onChange={(e) => setMes(e.target.value)} />
            <div className="grid gap-1">
              <span id="relatorio-clientes" className="text-xs font-semibold text-slate-500 uppercase">Clientes</span>
              <div aria-labelledby="relatorio-clientes">
                <Segmentado rotulo="Clientes do relatório" valor={segmento} onChange={setSegmento}
                  opcoes={[['todos', 'Todos'], ['taxi', 'Só Taxi'], ['outros', 'Sem Taxi']] as const} />
              </div>
            </div>
            <DialogFooter>
              <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700" onClick={() => setAberto(false)}>
                Cancelar
              </button>
              <Button type="submit" className={PILULA} disabled={baixando || !mes}>
                <FileSpreadsheet aria-hidden /> {baixando ? 'Gerando…' : 'Baixar Excel'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
