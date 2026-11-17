import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, Clock, History, KeyRound, Pause, Play, PlugZap, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatarData, formatarDataHora } from '@/components/shared/formatos';
import { ROTULO_QUALIDADE, TOM } from '@/components/shared/tons';
import { Vazio } from '@/components/shared/Vazio';
import { api, mensagemDeErro } from '@/lib/api';
import { PILULA } from '@/components/shared/visual';
import { ROTULO_EXECUCAO, ROTULO_STATUS, type Conta, type Execucao } from './tipos';

const rotulo = (mapa: Record<string, { texto: string; cls: string }>, chave: string) =>
  mapa[chave] ?? { texto: chave, cls: TOM.neutro };

function Dado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="p-4">
      <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{titulo}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-700">{children}</dd>
    </div>
  );
}

function Recolhivel({ icone: Icone, titulo, children }: { icone: typeof History; titulo: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Icone className="size-4 text-blue-600" aria-hidden />
        {titulo}
        <ChevronDown className="ml-auto size-4 text-slate-400 transition-transform duration-300 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-slate-100">{children}</div>
    </details>
  );
}

export function ContaWaba({ conta, onAlterada }: { conta: Conta; onAlterada: () => void }) {
  const [execucoes, setExecucoes] = useState<Execucao[] | null>(null);
  const [token, setToken] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const base = `/admin/contas/${conta.id}`;
  const pausada = conta.status === 'PAUSADA';

  const carregarExecucoes = () =>
    void api.get<Execucao[]>(`${base}/execucoes`, { params: { limite: 10 } }).then((r) => setExecucoes(r.data)).catch(() => setExecucoes([]));
  useEffect(carregarExecucoes, [base]);

  async function acao(fn: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    try {
      await fn();
      toast.success(ok);
      onAlterada();
      carregarExecucoes();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    try {
      const { data } = await api.post<{ ok: boolean; problema?: string; tokenExpiraEm: string | null }>(`${base}/testar`);
      if (data.ok) toast.success(`Conexão OK${data.tokenExpiraEm ? ` (token expira em ${formatarDataHora(data.tokenExpiraEm)})` : ''}`);
      else toast.error(`Falhou: ${data.problema ?? 'motivo desconhecido'}`);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const status = ROTULO_STATUS[conta.status];
  return (
    <article className="rounded-2xl border border-slate-200 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
        <div className="space-y-1">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-800">
            <Smartphone className="size-4 text-blue-600" aria-hidden />
            {conta.nome}
            <Badge className={status.cls}>{status.texto}</Badge>
            {conta.semCustoMeta && <Badge className={TOM.neutro}>Sem custo da Meta</Badge>}
            {conta.sincronizando && <Badge className={TOM.marca}><RefreshCw className="animate-spin" aria-hidden /> Sincronizando</Badge>}
          </h3>
          <p className="text-xs text-slate-400">WABA <span className="font-mono">{conta.wabaId}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={ocupado} onClick={testar}><PlugZap aria-hidden /> Testar conexão</Button>
          <Button variant="outline" disabled={ocupado}
            onClick={() => acao(() => api.post(`${base}/atualizar-numeros`), 'Números atualizados')}><Smartphone aria-hidden /> Atualizar números</Button>
          <Button variant="ghost" disabled={ocupado} className="text-slate-500"
            onClick={() => acao(() => api.patch(base, { pausada: !pausada }), pausada ? 'Coleta retomada' : 'Coleta pausada')}>
            {pausada ? <><Play aria-hidden /> Retomar coleta</> : <><Pause aria-hidden /> Pausar coleta</>}
          </Button>
          <Button className={PILULA} disabled={ocupado || conta.sincronizando}
            onClick={() => acao(() => api.post(`${base}/sincronizar`), 'Sincronização iniciada')}><RefreshCw aria-hidden /> Sincronizar agora</Button>
        </div>
      </header>

      <div className="space-y-5 px-6 pb-6">
        {conta.ultimoErro && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription>{conta.ultimoErro}</AlertDescription>
          </Alert>
        )}

        <dl className="grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 lg:grid-cols-4 lg:divide-x">
          <Dado titulo="Último sync"><span className="tabular-nums">{formatarDataHora(conta.ultimoSync)}</span></Dado>
          <Dado titulo="Histórico desde">{conta.historicoDesde ? formatarData(conta.historicoDesde) : <span className="font-normal text-slate-400">coletando…</span>}</Dado>
          <Dado titulo="Moeda">{conta.moeda}</Dado>
          <Dado titulo="Access token">
            <span className="font-mono">••••{conta.tokenUltimos4}</span>
            <span className={`block text-xs font-normal ${conta.tokenExpiraEm ? 'text-atencao-texto' : 'text-slate-500'}`}>
              {conta.tokenExpiraEm ? `expira ${formatarDataHora(conta.tokenExpiraEm)}` : 'não expira'}
            </span>
          </Dado>
        </dl>
        {conta.tokenExpiraEm && (
          <Alert variant="aviso" className="px-3 py-2 text-xs">
            <Clock aria-hidden />
            <AlertDescription className="text-xs">Este token vence. Troque por um token de System User, que não expira, para a coleta não parar.</AlertDescription>
          </Alert>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200">
          <p className="px-4 py-3 text-sm font-semibold text-slate-800">
            Números <span className="font-normal text-slate-400 tabular-nums">({conta.numeros.length})</span>
          </p>
          {conta.numeros.length === 0 ? (
            <div className="border-t border-slate-100"><Vazio icone={Smartphone} texto="Nenhum número encontrado. Clique em “Atualizar números” para buscar na Meta." /></div>
          ) : (
            <div className="border-t border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="pl-4">Número</TableHead><TableHead>Nome verificado</TableHead><TableHead>Qualidade</TableHead><TableHead className="pr-4 text-right">Coletar</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {conta.numeros.map((n) => {
                    const q = rotulo(ROTULO_QUALIDADE, n.qualidade);
                    return (
                      <TableRow key={n.id} className={n.coletaAtiva ? '' : 'opacity-60'}>
                        <TableCell className="pl-4 font-semibold text-slate-800 tabular-nums">
                          {n.display} {n.naoEncontradoNaMeta && <Badge className={`ml-1 ${TOM.aviso}`}>não encontrado na Meta</Badge>}
                        </TableCell>
                        <TableCell className="text-slate-600">{n.nomeVerificado ?? '—'}</TableCell>
                        <TableCell><Badge className={q.cls}>{q.texto}</Badge></TableCell>
                        <TableCell className="pr-4 text-right">
                          <Switch checked={n.coletaAtiva} aria-label={`Coletar ${n.display}`} disabled={ocupado}
                            onCheckedChange={(v) => acao(() => api.patch(`/admin/numeros/${n.id}`, { coletaAtiva: v }), v ? 'Coleta ativada' : 'Coleta desativada')} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          <Recolhivel icone={History} titulo="Últimas execuções">
            {execucoes?.length === 0 ? (
              <Vazio icone={History} texto="Nenhuma execução ainda." />
            ) : (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow><TableHead className="pl-4">Início</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead>Janela</TableHead><TableHead className="text-right">Linhas</TableHead><TableHead className="pr-4">Erro</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {execucoes?.map((x) => {
                    const s = rotulo(ROTULO_EXECUCAO, x.status);
                    return (
                      <TableRow key={x.id}>
                        <TableCell className="pl-4 tabular-nums">{formatarDataHora(x.inicio)}</TableCell>
                        <TableCell><Badge className={TOM.neutro}>{x.origem}</Badge></TableCell>
                        <TableCell><Badge className={s.cls}>{s.texto}</Badge></TableCell>
                        <TableCell className="tabular-nums">{formatarData(x.janelaDe)} – {formatarData(x.janelaAte)}</TableCell>
                        <TableCell className="text-right tabular-nums">{x.linhas.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="max-w-64 truncate pr-4 text-erro-texto" title={x.erro ?? ''}>{x.erro ?? <span className="text-slate-400">—</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Recolhivel>
          <Recolhivel icone={KeyRound} titulo="Trocar Access Token">
            <form className="flex flex-wrap gap-2 p-4" onSubmit={(e) => {
              e.preventDefault();
              void acao(() => api.patch(base, { token }), 'Token trocado').then(() => setToken(''));
            }}>
              <Input type="password" autoComplete="off" required aria-label="Novo Access Token" value={token}
                onChange={(e) => setToken(e.target.value)} placeholder="Novo Access Token (System User)" className="w-80 max-w-full" />
              <Button type="submit" variant="outline" disabled={ocupado}>Trocar token</Button>
            </form>
          </Recolhivel>
        </div>
      </div>
    </article>
  );
}
