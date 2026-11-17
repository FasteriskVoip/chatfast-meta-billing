import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, mensagemDeErro } from '@/lib/api';
import { Smartphone } from 'lucide-react';
import { PILULA } from '@/components/shared/visual';
import { Campo } from './Formulario';

export function FormConta({
  clienteId, aberto, onFechar, onSalvo,
}: { clienteId: string; aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ wabaId: '', token: '', nome: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/admin/clientes/${clienteId}/contas`, { wabaId: f.wabaId, token: f.token, nome: f.nome || undefined });
      toast.success('Conta cadastrada. Coletando o histórico…');
      setF({ wabaId: '', token: '', nome: '' });
      onSalvo();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle><Smartphone aria-hidden /> Nova conta WABA</DialogTitle></DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <Campo id="wabaId" rotulo="WABA ID" ajuda="O número da conta do WhatsApp Business. Fica no Gerenciador do WhatsApp da Meta, em Configurações da conta." required inputMode="numeric" value={f.wabaId} onChange={(e) => setF({ ...f, wabaId: e.target.value.trim() })} />
          <Campo id="nome" rotulo="Nome (opcional)" ajuda="Um apelido para reconhecer a conta. Se ficar vazio, usamos o nome que vem da Meta." value={f.nome} maxLength={120} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          <Campo id="token" rotulo="Access Token da Meta" ajuda="A chave que dá acesso aos dados de consumo. Gere no Business Manager, em Usuários do sistema." type="password" autoComplete="off" required value={f.token}
            onChange={(e) => setF({ ...f, token: e.target.value })}>
            <p className="text-xs text-slate-400">Use um token de System User (não expira) com a permissão <span className="font-mono">whatsapp_business_management</span>.</p>
          </Campo>
          {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
          <DialogFooter>
            <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700" onClick={onFechar}>Cancelar</button>
            <Button type="submit" className={PILULA} disabled={salvando}>{salvando ? 'Validando na Meta…' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
