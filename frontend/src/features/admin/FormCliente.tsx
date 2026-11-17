import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, mensagemDeErro } from '@/lib/api';
import { Building2 } from 'lucide-react';
import { PILULA } from '@/components/shared/visual';
import { Campo, erroDoCampo } from './Formulario';

export function FormCliente({ aberto, onFechar, onSalvo }: { aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ nome: '', companyid: '', tokenChatfast: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.post('/admin/clientes', f);
      toast.success('Cliente cadastrado');
      setF({ nome: '', companyid: '', tokenChatfast: '' });
      onSalvo();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const geral = erro && !['nome', 'companyid', 'tokenChatfast'].some((c) => erroDoCampo(erro, c)) ? erro : null;
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle><Building2 aria-hidden /> Novo cliente</DialogTitle></DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <Campo id="nome" rotulo="Nome" ajuda="Como o cliente aparece aqui no admin." required maxLength={120} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} erro={erroDoCampo(erro, 'nome')} />
          <Campo id="companyid" rotulo="companyid do Chatfast" ajuda="O identificador da empresa no Chatfast. Ele aparece na URL quando o cliente abre o painel." required value={f.companyid} placeholder="00000000-0000-0000-0000-000000000000"
            onChange={(e) => setF({ ...f, companyid: e.target.value.trim() })} erro={erroDoCampo(erro, 'companyid')} />
          <Campo id="tokenChatfast" rotulo="Token Chatfast" ajuda="Gerado no Chatfast do cliente, em Integração via API. Serve para confirmar quem abre o dashboard." type="password" autoComplete="off" required
            value={f.tokenChatfast} onChange={(e) => setF({ ...f, tokenChatfast: e.target.value })} erro={erroDoCampo(erro, 'tokenChatfast')} />
          {geral && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{geral}</p>}
          <DialogFooter>
            <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700" onClick={onFechar}>Cancelar</button>
            <Button type="submit" className={PILULA} disabled={salvando}>{salvando ? 'Validando…' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
