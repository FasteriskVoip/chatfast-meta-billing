import { useEffect, useState } from 'react';
import { AlertTriangle, DollarSign, History, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatarData } from '@/components/shared/formatos';
import { Vazio } from '@/components/shared/Vazio';
import { api, mensagemDeErro } from '@/lib/api';
import { PILULA, TituloCartao } from '@/components/shared/visual';
import { Campo } from './Formulario';
import type { Painel } from './tipos';

interface Cotacao { id: string; valor: string; vigenteDesde: string; criadoPor: string }

const reais = (valor: string) => `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

/** Cotação USD→BRL global com vigência: o passado nunca muda (US-12). */
export function Cotacoes({ painel, onAlterada }: { painel: Painel; onAlterada: () => void }) {
  const [lista, setLista] = useState<Cotacao[] | null>(null);
  const [f, setF] = useState({ valor: '', vigenteDesde: new Date().toISOString().slice(0, 10) });
  const [salvando, setSalvando] = useState(false);

  const carregar = () => void api.get<Cotacao[]>('/admin/cotacoes').then((r) => setLista(r.data)).catch(() => setLista([]));
  useEffect(carregar, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post('/admin/cotacoes', f);
      toast.success('Cotação salva');
      setF({ ...f, valor: '' });
      carregar();
      onAlterada();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {painel.semCotacao && (
        <Alert variant="destructive" className="entrar">
          <AlertTriangle aria-hidden />
          <AlertTitle>Nenhuma cotação cadastrada</AlertTitle>
          <AlertDescription>Sem ela, o custo em reais fica indisponível no dashboard dos clientes.</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="entrar space-y-5 rounded-2xl border border-slate-200 bg-card p-6 shadow-sm" style={{ animationDelay: '60ms' }}>
          <TituloCartao icone={DollarSign} titulo="Cotação vigente" descricao="Quanto vale US$ 1 em reais para calcular o custo." />
          {painel.cotacaoVigente ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">US$ 1 =</p>
              <p className="text-3xl font-bold text-slate-800 tabular-nums">{reais(painel.cotacaoVigente.valor)}</p>
              <p className="text-xs text-slate-500">desde {formatarData(painel.cotacaoVigente.vigenteDesde)}</p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              {painel.semCotacao ? 'Nenhuma cotação ainda.' : 'Só há cotações futuras; nenhuma vale para hoje.'}
            </p>
          )}

          <form onSubmit={salvar} className="space-y-3 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-800">Nova cotação</p>
            <Campo id="cotacao-valor" rotulo="Valor em reais" required inputMode="decimal" placeholder="5,4300" value={f.valor}
              ajuda="Quantos reais vale 1 dólar. Use vírgula ou ponto, com até 4 casas."
              onChange={(e) => setF({ ...f, valor: e.target.value })} />
            <Campo id="cotacao-desde" rotulo="Vale a partir de" required type="date" value={f.vigenteDesde}
              ajuda="O custo dos dias anteriores continua com a cotação antiga. O passado nunca muda."
              onChange={(e) => setF({ ...f, vigenteDesde: e.target.value })} />
            <Button type="submit" className={`${PILULA} w-full`} disabled={salvando}><Plus aria-hidden /> {salvando ? 'Salvando…' : 'Salvar cotação'}</Button>
          </form>
        </section>

        <section className="entrar rounded-2xl border border-slate-200 bg-card shadow-sm" style={{ animationDelay: '120ms' }}>
          <div className="p-6 pb-4">
            <TituloCartao icone={History} titulo="Histórico" descricao="Cada cotação vale até a data da seguinte." />
          </div>
          {!lista && <div className="space-y-2 px-6 pb-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>}
          {lista?.length === 0 && <Vazio icone={History} texto="Nenhuma cotação registrada ainda." />}
          {lista && lista.length > 0 && (
            <div className="border-t border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="pl-6">Vale a partir de</TableHead><TableHead className="pr-6 text-right">Valor</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6 text-slate-700 tabular-nums">{formatarData(c.vigenteDesde)}</TableCell>
                      <TableCell className="pr-6 text-right font-semibold text-slate-800 tabular-nums">{reais(c.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
