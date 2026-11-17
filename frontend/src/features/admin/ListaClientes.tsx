import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ExternalLink, Plus, Search, Smartphone, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatarDataHora } from '@/components/shared/formatos';
import { TOM } from '@/components/shared/tons';
import { Vazio } from '@/components/shared/Vazio';
import { api, mensagemDeErro } from '@/lib/api';
import { FormCliente } from './FormCliente';
import { Kpi, PILULA, TituloCartao } from '@/components/shared/visual';
import { ROTULO_STATUS, linkVerDashboard, type ClienteLinha, type Painel } from './tipos';

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR');

export function ListaClientes({ painel, onAbrir }: { painel: Painel | null; onAbrir: (id: string) => void }) {
  const [clientes, setClientes] = useState<ClienteLinha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    api.get<ClienteLinha[]>('/admin/clientes').then((r) => setClientes(r.data)).catch((e) => setErro(mensagemDeErro(e)));
  }, []);
  useEffect(carregar, [carregar]);

  const termo = busca.trim().toLowerCase();
  const visiveis = clientes?.filter((c) => !termo || c.nome.toLowerCase().includes(termo) || c.companyid.includes(termo));
  const ativos = clientes?.filter((c) => c.status === 'ATIVO').length ?? 0;
  const contas = clientes?.reduce((s, c) => s + c.contas, 0) ?? 0;
  const problemas = painel?.contasComProblema ?? 0;

  return (
    <>
      {erro && <p role="alert" className="text-sm text-erro-texto">{erro}</p>}

      {clientes && painel ? (
        <section
          aria-label="Resumo"
          className="entrar grid grid-cols-1 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          style={{ animationDelay: '60ms' }}
        >
          <Kpi icone={Users} tom={TOM.marca} rotulo="Clientes" valor={clientes.length} formatar={inteiro} detalhe={`${ativos} ativo(s)`} />
          <Kpi icone={Smartphone} tom={TOM.marca} rotulo="Contas WABA" valor={contas} formatar={inteiro} detalhe="somando todos os clientes" />
          {problemas ? (
            <Kpi icone={AlertTriangle} tom={TOM.erro} rotulo="Com problema" valor={problemas} formatar={inteiro} detalhe="token inválido, expirando ou erro no sync" corValor="text-erro-texto" />
          ) : (
            <Kpi icone={CheckCircle2} tom={TOM.sucesso} rotulo="Com problema" valor={0} formatar={inteiro} detalhe="tudo funcionando" />
          )}
        </section>
      ) : (
        !erro && <Skeleton className="h-28 w-full" />
      )}

      <section className="entrar rounded-2xl border border-slate-200 bg-card shadow-sm" style={{ animationDelay: '120ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <TituloCartao icone={Users} titulo="Clientes" descricao="Clique num cliente para ver as contas WABA e os tokens." />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                type="search"
                aria-label="Buscar cliente"
                placeholder="Buscar por nome ou companyid"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
            <Button className={PILULA} onClick={() => setNovo(true)}><Plus aria-hidden /> Novo cliente</Button>
          </div>
        </div>

        {!clientes && !erro && <div className="space-y-2 px-5 pb-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}

        {clientes?.length === 0 && (
          <Vazio icone={Users} texto="Nenhum cliente cadastrado ainda. Cadastre o primeiro para começar a acompanhar o consumo.">
            <Button variant="outline" size="sm" onClick={() => setNovo(true)}><Plus aria-hidden /> Cadastrar cliente</Button>
          </Vazio>
        )}

        {visiveis && clientes!.length > 0 && (
          <div className="border-t border-slate-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Cliente</TableHead>
                  <TableHead className="text-right">Contas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último sync</TableHead>
                  <TableHead className="pr-5"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">Nenhum cliente encontrado para “{busca}”.</TableCell></TableRow>
                )}
                {visiveis.map((c) => (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    className={`group cursor-pointer outline-none focus-visible:bg-blue-50 ${c.status === 'INATIVO' ? 'opacity-60' : ''}`}
                    onClick={() => onAbrir(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && onAbrir(c.id)}
                  >
                    <TableCell className="py-3 pl-5">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                        {c.alerta && <AlertTriangle className="size-4 text-erro" aria-label="Precisa de atenção" />}
                        {c.nome}
                        {c.status === 'INATIVO' && <Badge className={TOM.neutro}>Inativo</Badge>}
                        {c.alertaChatfast && <Badge className={TOM.erro}>Token Chatfast recusado</Badge>}
                      </div>
                      <p className="font-mono text-xs text-slate-400">{c.companyid}</p>
                    </TableCell>
                    <TableCell className="text-right text-slate-700 tabular-nums">{c.contas}</TableCell>
                    <TableCell>
                      {c.piorStatus
                        ? <Badge className={ROTULO_STATUS[c.piorStatus].cls}>{ROTULO_STATUS[c.piorStatus].texto}</Badge>
                        : <span className="text-xs text-slate-400">sem contas</span>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 tabular-nums">{formatarDataHora(c.ultimoSync)}</TableCell>
                    <TableCell className="pr-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm" className="text-blue-600">
                          <a href={linkVerDashboard(c.companyid)}>Dashboard <ExternalLink className="size-3.5" aria-hidden /></a>
                        </Button>
                        <ChevronRight className="size-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <FormCliente aberto={novo} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />
    </>
  );
}
