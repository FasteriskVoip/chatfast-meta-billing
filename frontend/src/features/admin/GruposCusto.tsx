import { useEffect, useState } from 'react';
import { Layers, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, mensagemDeErro } from '@/lib/api';
import { PILULA, TituloCartao } from '@/components/shared/visual';
import { Campo, erroDoCampo } from './Formulario';
import { formatarPreco, type ClienteLinha, type GrupoCusto } from './tipos';

const VAZIO = { id: '', nome: '', precoBrl: '' };

/** Grupos de custo Fasterisk: o preço por mensagem que os clientes Taxi veem no lugar do custo da Meta. */
export function GruposCusto() {
  const [lista, setLista] = useState<GrupoCusto[] | null>(null);
  const [f, setF] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [clientes, setClientes] = useState<ClienteLinha[]>([]);

  const carregar = () => void api.get<GrupoCusto[]>('/admin/grupos-custo').then((r) => setLista(r.data)).catch(() => setLista([]));
  useEffect(carregar, []);
  useEffect(() => void api.get<ClienteLinha[]>('/admin/clientes').then((r) => setClientes(r.data)).catch(() => {}), []);
  // Só clientes Taxi usam o grupo; os demais ficam no Standard por padrão, mas sem efeito.
  const taxiNoGrupo = (id: string) => clientes.filter((c) => c.taxi && c.grupoCustoId === id);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const corpo = { nome: f.nome, precoBrl: f.precoBrl };
      if (f.id) await api.put(`/admin/grupos-custo/${f.id}`, corpo);
      else await api.post('/admin/grupos-custo', corpo);
      toast.success(f.id ? 'Grupo atualizado' : 'Grupo criado');
      setF(VAZIO);
      carregar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
      <form onSubmit={salvar} className="entrar space-y-4 rounded-2xl border border-slate-200 bg-card p-6 shadow-sm">
        <TituloCartao icone={Layers} titulo={f.id ? 'Editar grupo' : 'Novo grupo'}
          descricao="Preço por mensagem. O cliente Taxi vê esse valor no lugar do custo da Meta." />
        <Campo id="grupo-nome" rotulo="Nome" required maxLength={60} placeholder="Ex.: Premium" value={f.nome}
          onChange={(e) => setF({ ...f, nome: e.target.value })} erro={erroDoCampo(erro, 'nome')} />
        <Campo id="grupo-preco" rotulo="Preço por mensagem (R$)" required inputMode="decimal" placeholder="Ex.: 0,08" value={f.precoBrl}
          ajuda="Cobrado por mensagem, inclusive as que a Meta não cobra (para o Taxi não há grátis). Até 4 casas."
          onChange={(e) => setF({ ...f, precoBrl: e.target.value })} erro={erroDoCampo(erro, 'precoBrl')} />
        {f.id && <p className="text-xs text-atencao-texto">O novo preço vale para todo o histórico dos clientes deste grupo.</p>}
        {erro && !erroDoCampo(erro, 'nome') && !erroDoCampo(erro, 'precoBrl') && <p role="alert" className="text-xs text-erro-texto">{erro}</p>}
        <div className="flex gap-2">
          {f.id && <Button type="button" variant="outline" onClick={() => { setF(VAZIO); setErro(null); }}>Cancelar</Button>}
          <Button type="submit" className={`${PILULA} flex-1`} disabled={salvando}>
            {f.id ? <Pencil aria-hidden /> : <Plus aria-hidden />} {salvando ? 'Salvando…' : f.id ? 'Salvar alterações' : 'Criar grupo'}
          </Button>
        </div>
      </form>

      <section className="entrar rounded-2xl border border-slate-200 bg-card shadow-sm" style={{ animationDelay: '60ms' }}>
        <div className="p-6 pb-4">
          <TituloCartao icone={Layers} titulo="Grupos" descricao="Escolha o grupo de cada cliente Taxi no detalhe do cliente. O padrão é o Standard." />
        </div>
        {!lista ? (
          <div className="space-y-2 px-6 pb-6">{[0, 1].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (
          <div className="border-t border-slate-100">
            <Table>
              <TableHeader>
                <TableRow><TableHead className="pl-6">Grupo</TableHead><TableHead className="text-right">Preço por mensagem</TableHead><TableHead className="text-right">Clientes Taxi</TableHead><TableHead className="pr-6"><span className="sr-only">Ações</span></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="pl-6 font-semibold text-slate-800">{g.nome}</TableCell>
                    <TableCell className="text-right text-slate-700 tabular-nums">{formatarPreco(g.precoBrl)}</TableCell>
                    <TableCell className="max-w-72 text-right">
                      <span className="font-semibold text-slate-700 tabular-nums">{taxiNoGrupo(g.id).length}</span>
                      {taxiNoGrupo(g.id).length > 0 && (
                        <span className="block truncate text-xs text-slate-500" title={taxiNoGrupo(g.id).map((c) => c.nome).join(', ')}>
                          {taxiNoGrupo(g.id).map((c) => c.nome).join(', ')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setF({ id: g.id, nome: g.nome, precoBrl: g.precoBrl.replace('.', ',') }); setErro(null); }}>
                        <Pencil aria-hidden /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
