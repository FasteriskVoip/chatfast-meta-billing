import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Building2, Clock, LockKeyhole, Loader2, MonitorSmartphone, Phone, PlugZap, RefreshCw, ShieldX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOM } from './tons';
import { PILULA } from './visual';
import { Campo, erroDoCampo } from '@/features/admin/Formulario';
import { abrirSessao, cadastrarPrimeiroAcesso, codigoDeErro, mensagemDeErro, podeCadastrar, type SessaoAberta } from '@/lib/api';

/** Contato do suporte mostrado nas telas de bloqueio. */
const SUPORTE = { exibicao: '(61) 4042-6792', tel: '+556140426792' };

interface Bloqueio { titulo: string; texto: string; icone: LucideIcon; tom: string; suporte?: boolean; tentarDeNovo?: boolean }

const BLOQUEIOS: Record<string, Bloqueio> = {
  SEM_CADASTRO: {
    titulo: 'Função não liberada', icone: LockKeyhole, tom: TOM.marca, suporte: true,
    texto: 'O Consumo Meta ainda não está liberado para a sua conta. Para liberar, acione o suporte da Fasterisk.',
  },
  CLIENTE_INATIVO: {
    titulo: 'Conta desativada', icone: ShieldX, tom: TOM.neutro, suporte: true,
    texto: 'O acesso ao Consumo Meta está desativado para a sua conta. Os dados estão guardados. Para reativar, acione o suporte da Fasterisk.',
  },
  HELENA_RECUSOU_TOKEN: {
    titulo: 'Integração precisa ser atualizada', icone: PlugZap, tom: TOM.aviso, suporte: true,
    texto: 'A integração da sua conta com o Chatfast precisa ser atualizada. Acione o suporte da Fasterisk.',
  },
  AGENTE_DESCONHECIDO: {
    titulo: 'Acesso não autorizado', icone: ShieldX, tom: TOM.erro, suporte: true,
    texto: 'Seu usuário não tem acesso a este painel. Se precisar de acesso, acione o suporte da Fasterisk.',
  },
  SEM_USUARIO: {
    titulo: 'Abra pelo Chatfast', icone: MonitorSmartphone, tom: TOM.marca,
    texto: 'Este painel funciona dentro do Chatfast. Abra-o pelo menu do Chatfast para entrar.',
  },
  HELENA_INDISPONIVEL: {
    titulo: 'Não foi possível validar seu acesso', icone: Clock, tom: TOM.aviso, tentarDeNovo: true,
    texto: 'O Chatfast não respondeu agora. Tente de novo em alguns instantes.',
  },
};

/** Tela de acesso negado: diz o que houve, o que fazer e como falar com o suporte. */
export function TelaBloqueio({ titulo, texto, icone: Icone, tom, suporte, codigo, onTentarDeNovo }: Omit<Bloqueio, 'tentarDeNovo'> & {
  codigo?: string; onTentarDeNovo?: () => void;
}) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4 sm:p-6">
      <section role="alert" className="entrar w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-sm">
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center sm:px-8">
          <span className={`flex size-14 items-center justify-center rounded-full ${tom}`}>
            <Icone className="size-6" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-slate-800">{titulo}</h1>
          <p className="text-sm leading-relaxed text-slate-500">{texto}</p>
          {onTentarDeNovo && (
            <Button className={`${PILULA} mt-2`} onClick={onTentarDeNovo}><RefreshCw aria-hidden /> Tentar de novo</Button>
          )}
        </div>

        {suporte && (
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 sm:px-8">
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Suporte Fasterisk</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xl font-bold text-slate-800 tabular-nums select-all">
                <Phone className="size-5 text-blue-600" aria-hidden /> {SUPORTE.exibicao}
              </p>
              <Button asChild className={PILULA}>
                <a href={`tel:${SUPORTE.tel}`}><Phone aria-hidden /> Ligar</a>
              </Button>
            </div>
            {codigo && (
              <p className="mt-3 text-xs text-slate-400">
                Ao falar com o suporte, informe o código <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500">{codigo}</span>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Abre a sessão (validada na Helena) antes de mostrar qualquer dado. */
export function Acesso({ children, esqueleto }: {
  children: (s: SessaoAberta) => ReactNode;
  /** Estrutura da página mostrada enquanto a sessão é validada (carregamento progressivo). */
  esqueleto?: ReactNode;
}) {
  const [sessao, setSessao] = useState<SessaoAberta | null>(null);
  const [erro, setErro] = useState<{ codigo?: string; texto: string; podeCadastrar?: boolean } | null>(null);

  const abrir = useCallback(() => {
    setErro(null);
    abrirSessao()
      .then(setSessao)
      .catch((e) => setErro({ codigo: codigoDeErro(e), texto: mensagemDeErro(e), podeCadastrar: podeCadastrar(e) }));
  }, []);

  useEffect(abrir, [abrir]);

  // Empresa admin: sem cadastro → cadastra; token salvo recusado → troca o token. Nos dois casos, pela própria tela.
  if (erro?.podeCadastrar) return <PrimeiroAcesso onPronto={setSessao} trocarToken={erro.codigo === 'HELENA_RECUSOU_TOKEN'} />;
  if (erro) {
    // Erro sem tela própria (ex.: servidor fora do ar): mostra a mensagem da API, com suporte e nova tentativa.
    const b = (erro.codigo && BLOQUEIOS[erro.codigo]) || {
      titulo: 'Algo deu errado', texto: erro.texto, icone: TriangleAlert, tom: TOM.erro, suporte: true, tentarDeNovo: true,
    };
    return <TelaBloqueio {...b} codigo={erro.codigo} onTentarDeNovo={b.tentarDeNovo ? abrir : undefined} />;
  }
  if (!sessao) return esqueleto ?? <Carregando texto="Validando acesso…" />;
  return <>{children(sessao)}</>;
}

/**
 * Empresa de ADMIN_COMPANYIDS sem saída pelo admin: ainda não cadastrada (cadastra a própria empresa) ou com o
 * token salvo recusado pela Helena (cola um token novo). O backend confere que quem faz é admin na Helena.
 */
function PrimeiroAcesso({ onPronto, trocarToken = false }: { onPronto: (s: SessaoAberta) => void; trocarToken?: boolean }) {
  const [f, setF] = useState({ nome: 'Fasterisk', tokenChatfast: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      // Na troca de token o nome não vai: o backend mantém o nome já cadastrado.
      onPronto(await cadastrarPrimeiroAcesso(trocarToken ? '' : f.nome, f.tokenChatfast));
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
            <Building2 className="size-5 text-blue-600" aria-hidden /> {trocarToken ? 'Atualize o token Chatfast' : 'Primeiro acesso'}
          </h1>
          <p className="text-sm text-slate-500">
            {trocarToken
              ? 'O Chatfast recusou o token salvo da sua empresa (pode ter sido trocado ou revogado). Como administrador, cole um token novo para entrar.'
              : 'A sua empresa ainda não está cadastrada no Consumo Meta. Como administrador, cadastre-a para entrar no painel.'}
          </p>
        </div>
        {!trocarToken && (
          <Campo id="pa-nome" rotulo="Nome da empresa" required maxLength={120} value={f.nome}
            onChange={(e) => setF({ ...f, nome: e.target.value })} />
        )}
        <Campo id="pa-token" rotulo="Token Chatfast" type="password" autoComplete="off" required value={f.tokenChatfast}
          ajuda="Gerado no Chatfast em Integração via API. Serve para confirmar quem abre o painel."
          onChange={(e) => setF({ ...f, tokenChatfast: e.target.value })} erro={erroToken} />
        {erro && !erroToken && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
        )}
        <Button type="submit" className={`${PILULA} w-full`} disabled={salvando}>
          {salvando ? 'Validando no Chatfast…' : trocarToken ? 'Atualizar e entrar' : 'Cadastrar e entrar'}
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
