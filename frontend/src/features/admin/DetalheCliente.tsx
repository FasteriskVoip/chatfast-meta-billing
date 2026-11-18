import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, ExternalLink, KeyRound, Plus, Power, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarData } from '@/components/shared/formatos';
import { TOM } from '@/components/shared/tons';
import { Vazio } from '@/components/shared/Vazio';
import { api, mensagemDeErro } from '@/lib/api';
import { AlertasConsumo } from './AlertasConsumo';
import { ContaWaba } from './ContaWaba';
import { FormConta } from './FormConta';
import { PILULA, TituloCartao } from '@/components/shared/visual';
import { CampoChave } from './Formulario';
import { linkVerDashboard, type ClienteDetalhe } from './tipos';

export function DetalheCliente({ clienteId, alertasAtivos, onVoltar, onAlterada }: {
  clienteId: string; alertasAtivos: boolean; onVoltar: () => void; onAlterada: () => void;
}) {
  const [c, setC] = useState<ClienteDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novaConta, setNovaConta] = useState(false);
  const [token, setToken] = useState('');

  const carregar = useCallback(() => {
    api.get<ClienteDetalhe>(`/admin/clientes/${clienteId}`).then((r) => setC(r.data)).catch((e) => setErro(mensagemDeErro(e)));
    onAlterada();
  }, [clienteId, onAlterada]);
  useEffect(carregar, [carregar]);

  async function patch(dados: object, ok: string) {
    try {
      await api.patch(`/admin/clientes/${clienteId}`, dados);
      toast.success(ok);
      carregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  const voltar = (
    <button onClick={onVoltar} className="flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-slate-500 outline-none hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-ring/50">
      <ArrowLeft className="size-4" aria-hidden /> Todos os clientes
    </button>
  );
  if (erro) return <>{voltar}<p role="alert" className="text-sm text-erro-texto">{erro}</p></>;
  if (!c) return <>{voltar}<Skeleton className="h-28 w-full" /><Skeleton className="h-72 w-full" /></>;
  const inativo = c.status === 'INATIVO';

  return (
    <>
      {voltar}

      <section className="entrar space-y-5 rounded-2xl border border-slate-200 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800">
              <Building2 className="size-5 text-blue-600" aria-hidden />
              {c.nome}
              {inativo
                ? <Badge className={TOM.neutro}>Inativo desde {c.inativoDesde ? formatarData(c.inativoDesde) : '—'}</Badge>
                : <Badge className={TOM.sucesso}>Ativo</Badge>}
              {c.taxi && <Badge className={TOM.marca}>Taxi</Badge>}
            </h2>
            <p className="text-xs text-slate-400">companyid <span className={`rounded px-1.5 py-0.5 font-mono ${TOM.neutro}`}>{c.companyid}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={linkVerDashboard(c.companyid)}><ExternalLink aria-hidden /> Ver dashboard</a>
            </Button>
            <Button
              variant={inativo ? 'secondary' : 'destructive'}
              onClick={() => {
                const msg = inativo
                  ? 'Reativar o cliente? A coleta volta e o período parado é reprocessado.'
                  : 'Desativar o cliente? A coleta para e o dashboard fica bloqueado (os dados são mantidos).';
                if (window.confirm(msg)) void patch({ status: inativo ? 'ATIVO' : 'INATIVO' }, inativo ? 'Cliente reativado' : 'Cliente desativado');
              }}
            >
              <Power aria-hidden /> {inativo ? 'Reativar' : 'Desativar'}
            </Button>
          </div>
        </div>

        <div className="max-w-md">
          <CampoChave id="detalhe-taxi" rotulo="Cliente Taxi" checked={c.taxi}
            descricao='Entra no filtro "Taxi" do admin e do relatório. Só clientes Taxi recebem alertas de consumo.'
            onChange={(v) => void patch({ taxi: v }, v ? 'Marcado como Cliente Taxi' : 'Desmarcado como Cliente Taxi')} />
        </div>

        {c.alertaChatfast && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>O Chatfast recusou o token deste cliente</AlertTitle>
            <AlertDescription>Gere um novo token de Integração via API no Chatfast e cole abaixo. Sem ele o cliente não consegue abrir o dashboard.</AlertDescription>
          </Alert>
        )}

        <form
          className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void patch({ tokenChatfast: token }, 'Token Chatfast atualizado').then(() => setToken(''));
          }}
        >
          <TituloCartao icone={KeyRound} titulo="Token Chatfast" descricao={<>Usado para validar quem abre o dashboard. Atual termina em <span className="font-mono">••••{c.tokenChatfastUltimos4}</span>.</>} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Input type="password" autoComplete="off" required aria-label="Novo token Chatfast" value={token}
              onChange={(e) => setToken(e.target.value)} placeholder="Cole o novo token" className="w-80 max-w-full" />
            <Button type="submit" variant="outline">Trocar token</Button>
          </div>
        </form>

        <AlertasConsumo
          key={`${c.limiteDiarioBrl}|${c.limiteMensalBrl}`}
          cliente={c}
          alertasAtivos={alertasAtivos}
          onSalvar={async (limites) => {
            try {
              await api.patch(`/admin/clientes/${clienteId}`, limites);
              toast.success('Limites de alerta salvos');
              carregar();
              return null;
            } catch (e) {
              return mensagemDeErro(e);
            }
          }}
        />
      </section>

      <div className="entrar flex flex-wrap items-center justify-between gap-3" style={{ animationDelay: '60ms' }}>
        <TituloCartao icone={Smartphone} titulo={<>Contas WABA <span className="font-normal text-slate-400 tabular-nums">({c.contas.length})</span></>}
          descricao="Cada conta do WhatsApp Business deste cliente." />
        {c.contas.length > 0 && <Button className={PILULA} onClick={() => setNovaConta(true)}><Plus aria-hidden /> Nova conta</Button>}
      </div>

      {c.contas.length === 0 && (
        <section className="entrar rounded-2xl border border-dashed border-slate-200 bg-card" style={{ animationDelay: '120ms' }}>
          <Vazio icone={Smartphone} texto="Nenhuma conta WABA cadastrada. Cadastre a conta para começar a coletar o consumo deste cliente.">
            <Button className={PILULA} onClick={() => setNovaConta(true)}><Plus aria-hidden /> Nova conta</Button>
          </Vazio>
        </section>
      )}
      {c.contas.map((conta, i) => (
        <div key={conta.id} className="entrar" style={{ animationDelay: `${(i + 2) * 60}ms` }}>
          <ContaWaba conta={conta} onAlterada={carregar} />
        </div>
      ))}

      <FormConta clienteId={clienteId} aberto={novaConta} onFechar={() => setNovaConta(false)} onSalvo={() => { setNovaConta(false); carregar(); }} />
    </>
  );
}
