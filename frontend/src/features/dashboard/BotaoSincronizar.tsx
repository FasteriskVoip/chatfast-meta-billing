import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, codigoDeErro, mensagemDeErro } from '@/lib/api';
import { PILULA } from '@/components/shared/visual';
import type { Status } from './tipos';

interface Props {
  status: Status | null;
  params: Record<string, string>;
  /** recarrega status (e o resumo quando terminar) */
  onAtualizar: () => Promise<Status | null>;
  onConcluido: () => void;
}

/** Cliente sincroniza no máximo a cada 15 min por conta (FR-047); polling de /status a cada 3 s. */
export function BotaoSincronizar({ status, params, onAtualizar, onConcluido }: Props) {
  const [agora, setAgora] = useState(Date.now());
  const [aguardando, setAguardando] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const sincronizando = aguardando || Boolean(status?.sincronizando);
  const liberaEm = status?.sincronizarDisponivelEm ? new Date(status.sincronizarDisponivelEm).getTime() : 0;
  const minutos = Math.ceil((liberaEm - agora) / 60_000);
  const bloqueado = minutos > 0;

  async function acompanhar() {
    const s = await onAtualizar().catch(() => null);
    if (s?.sincronizando) {
      timer.current = window.setTimeout(acompanhar, 3000);
      return;
    }
    setAguardando(false);
    onConcluido();
    toast.success('Dados sincronizados com a Meta');
  }

  async function sincronizar() {
    try {
      await api.post('/dashboard/sincronizar', {}, { params });
      setAguardando(true);
      timer.current = window.setTimeout(acompanhar, 3000);
    } catch (e) {
      if (codigoDeErro(e) === 'SYNC_AGUARDE') await onAtualizar();
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <Button onClick={sincronizar} disabled={sincronizando || bloqueado} className={`${PILULA} print:hidden`}>
      <RefreshCw className={sincronizando ? 'animate-spin' : ''} aria-hidden />
      {sincronizando ? 'Sincronizando…' : bloqueado ? `Disponível em ${minutos} min` : 'Sincronizar com a Meta'}
    </Button>
  );
}
