import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Building2, LockKeyhole, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Vazio } from './Vazio';
import { PILULA } from './visual';
import { Campo, erroDoCampo } from '@/features/admin/Formulario';
import { abrirSessao, cadastrarPrimeiroAcesso, codigoDeErro, mensagemDeErro, podeCadastrar, type SessaoAberta } from '@/lib/api';

const MENSAGENS: Record<string, string> = {
  SEM_USUARIO: 'Abra este painel pelo Chatfast.',
  SEM_CADASTRO: 'Conta não cadastrada. Fale com a Fasterisk.',
  AGENTE_DESCONHECIDO: 'Acesso não autorizado.',
  HELENA_INDISPONIVEL: 'Não foi possível validar seu acesso agora. Tente novamente.',
  HELENA_RECUSOU_TOKEN: 'Integração com o Chatfast precisa ser atualizada. Fale com a Fasterisk.',
  CLIENTE_INATIVO: 'Conta desativada. Fale com a Fasterisk.',
};

/** Abre a sessão (validada na Helena) antes de mostrar qualquer dado. */
export function Acesso({ children }: { children: (s: SessaoAberta) => ReactNode }) {
  const [sessao, setSessao] = useState<SessaoAberta | null>(null);
  const [erro, setErro] = useState<{ codigo?: string; texto: string; podeCadastrar?: boolean } | null>(null);

  const abrir = useCallback(() => {
    setErro(null);
    abrirSessao()
      .then(setSessao)
      .catch((e) => {
        const codigo = codigoDeErro(e);
        setErro({ codigo, texto: (codigo && MENSAGENS[codigo]) || mensagemDeErro(e), podeCadastrar: podeCadastrar(e) });
      });
  }, []);

  useEffect(abrir, [abrir]);

  if (erro?.podeCadastrar) return <PrimeiroAcesso onPronto={setSessao} />;
  if (erro) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-6">
        <div className="entrar w-full max-w-md rounded-2xl border border-slate-200 bg-card shadow-sm">
          <Vazio icone={LockKeyhole} texto={erro.texto}>
            {erro.codigo === 'HELENA_INDISPONIVEL' && (
              <Button className={PILULA} onClick={abrir}><RefreshCw aria-hidden /> Tentar de novo</Button>
            )}
          </Vazio>
        </div>
      </div>
    );
  }
  if (!sessao) return <Carregando texto="Validando acesso…" />;
  return <>{children(sessao)}</>;
}

/**
 * Primeiro acesso da Fasterisk (empresa de ADMIN_COMPANYIDS ainda não cadastrada): o admin cadastra
 * a própria empresa aqui e já entra. O backend confere que quem cadastra é admin na Helena.
 */
function PrimeiroAcesso({ onPronto }: { onPronto: (s: SessaoAberta) => void }) {
  const [f, setF] = useState({ nome: 'Fasterisk', tokenChatfast: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      onPronto(await cadastrarPrimeiroAcesso(f.nome, f.tokenChatfast));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const erroToken = erroDoCampo(erro, 'tokenChatfast');
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-6">
      <form onSubmit={salvar} className="entrar w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Building2 className="size-5 text-blue-600" aria-hidden /> Primeiro acesso
          </h1>
          <p className="text-sm text-slate-500">
            A sua empresa ainda não está cadastrada no Consumo Meta. Como administrador, cadastre-a para entrar no painel.
          </p>
        </div>
        <Campo id="pa-nome" rotulo="Nome da empresa" required maxLength={120} value={f.nome}
          onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <Campo id="pa-token" rotulo="Token Chatfast" type="password" autoComplete="off" required value={f.tokenChatfast}
          ajuda="Gerado no Chatfast em Integração via API. Serve para confirmar quem abre o painel."
          onChange={(e) => setF({ ...f, tokenChatfast: e.target.value })} erro={erroToken} />
        {erro && !erroToken && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
        )}
        <Button type="submit" className={`${PILULA} w-full`} disabled={salvando}>
          {salvando ? 'Validando no Chatfast…' : 'Cadastrar e entrar'}
        </Button>
      </form>
    </div>
  );
}

/** Tela de espera centralizada (validação da sessão, carga da rota). */
export function Carregando({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden /> {texto}
    </div>
  );
}
