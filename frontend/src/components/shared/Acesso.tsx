import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LockKeyhole, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Vazio } from './Vazio';
import { PILULA } from './visual';
import { abrirSessao, codigoDeErro, mensagemDeErro, type SessaoAberta } from '@/lib/api';

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
  const [erro, setErro] = useState<{ codigo?: string; texto: string } | null>(null);

  const abrir = useCallback(() => {
    setErro(null);
    abrirSessao()
      .then(setSessao)
      .catch((e) => {
        const codigo = codigoDeErro(e);
        setErro({ codigo, texto: (codigo && MENSAGENS[codigo]) || mensagemDeErro(e) });
      });
  }, []);

  useEffect(abrir, [abrir]);

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

/** Tela de espera centralizada (validação da sessão, carga da rota). */
export function Carregando({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden /> {texto}
    </div>
  );
}
