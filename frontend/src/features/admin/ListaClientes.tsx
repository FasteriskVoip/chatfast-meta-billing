import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronRight, ChevronsUpDown, ExternalLink, Plus, Search, Smartphone, Users, Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatarBRL, formatarDataHora, formatarDiaMes, formatarNumero } from '@/components/shared/formatos';
import { TOM } from '@/components/shared/tons';
import { Vazio } from '@/components/shared/Vazio';
import { api, mensagemDeErro } from '@/lib/api';
import { telaPersistida } from '@/lib/telaPersistida';
import { FormCliente } from './FormCliente';
import { RelatorioClientes } from './RelatorioClientes';
import { Kpi, PILULA, Segmentado, TituloCartao } from '@/components/shared/visual';
import { ROTULO_STATUS, linkVerDashboard, type ClienteLinha, type ConsumoMes, type Painel } from './tipos';

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR');
const reais = (n: number) => formatarBRL(n.toFixed(2));

/** Custo do mês na tabela: ausente vira "—" (nunca R$ 0,00); parcial ganha um asterisco explicado no title. */
function CustoMes({ c, falhou }: { c?: ConsumoMes['clientes'][number]; falhou: boolean }) {
  if (falhou) return <span className="text-slate-400" title="Não foi possível calcular o custo agora">—</span>;
  if (!c) return <Skeleton className="ml-auto h-4 w-20" />;
  if (c.custoBrl === null) return <span className="text-slate-400" title="A Meta não informa custo para este cliente no mês">—</span>;
  const parcial = c.custoSituacao === 'parcial';
  return (
    <span className="font-semibold text-slate-800" title={parcial ? 'Parcial: parte do mês sem custo da Meta; o valor real é maior ou igual' : undefined}>
      {formatarBRL(c.custoBrl)}{parcial && <span className="text-atencao-texto">*</span>}
    </span>
  );
}

/** Compara por um valor; sem valor (custo indisponível, nunca sincronizou) fica no fim nas duas direções. */
export function comparadorNulosNoFim<T>(valor: (t: T) => string | number | null, desc: boolean) {
  return (a: T, b: T) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const r = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : va - (vb as number);
    return desc ? -r : r;
  };
}

type Coluna = 'nome' | 'contas' | 'enviadas' | 'custo' | 'fasterisk' | 'sync';
type Ordem = { coluna: Coluna; desc: boolean };

/** Cabeçalho que ordena ao clicar: 1º clique na direção mais útil, 2º inverte. */
function CabecalhoOrdenavel({ coluna, rotulo, ordem, onOrdenar, className = '' }: {
  coluna: Coluna; rotulo: string; ordem: Ordem; onOrdenar: (c: Coluna) => void; className?: string;
}) {
  const ativa = ordem.coluna === coluna;
  const Icone = !ativa ? ChevronsUpDown : ordem.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead className={className} aria-sort={ativa ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={`inline-flex items-center gap-1 rounded uppercase tracking-wide outline-none hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-ring/50 ${ativa ? 'text-blue-600' : ''}`}
      >
        {rotulo}
        <Icone className={`size-3.5 ${ativa ? '' : 'text-slate-300'}`} aria-hidden />
      </button>
    </TableHead>
  );
}

export function ListaClientes({ painel, onAbrir }: { painel: Painel | null; onAbrir: (id: string) => void }) {
  const [clientes, setClientes] = useState<ClienteLinha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState('');
  const [segmento, setSegmento] = useState<'todos' | 'taxi' | 'outros'>('todos');
  const [consumo, setConsumo] = useState<ConsumoMes | null>(null);
  const [consumoFalhou, setConsumoFalhou] = useState(false);
  const [ordem, setOrdem] = telaPersistida<Ordem>('ordem-clientes', { coluna: 'nome', desc: false });
  // Nome começa de A a Z; números (contas, custo, sync) começam do maior/mais recente.
  const ordenar = (coluna: Coluna) =>
    setOrdem((o) => (o.coluna === coluna ? { coluna, desc: !o.desc } : { coluna, desc: coluna !== 'nome' }));

  const carregar = useCallback(() => {
    api.get<ClienteLinha[]>('/admin/clientes').then((r) => setClientes(r.data)).catch((e) => setErro(mensagemDeErro(e)));
    // Separado da lista: com muitos clientes o custo demora mais, e a tabela não precisa esperar.
    setConsumoFalhou(false);
    api.get<ConsumoMes>('/admin/consumo').then((r) => setConsumo(r.data)).catch(() => setConsumoFalhou(true));
  }, []);
  useEffect(carregar, [carregar]);
  const custoDe = new Map(consumo?.clientes.map((c) => [c.clienteId, c]));
  const custoTotal = consumo?.total.custoBrl == null ? null : Number(consumo.total.custoBrl);

  const termo = busca.trim().toLowerCase();
  const valor: Record<Coluna, (c: ClienteLinha) => string | number | null> = {
    nome: (c) => c.nome,
    contas: (c) => c.contas,
    enviadas: (c) => custoDe.get(c.id)?.enviadas ?? null,
    custo: (c) => (custoDe.get(c.id)?.custoBrl == null ? null : Number(custoDe.get(c.id)!.custoBrl)),
    fasterisk: (c) => (custoDe.get(c.id)?.custoFasteriskBrl == null ? null : Number(custoDe.get(c.id)!.custoFasteriskBrl)),
    sync: (c) => (c.ultimoSync ? Date.parse(c.ultimoSync) : null),
  };
  const visiveis = clientes
    ?.filter((c) =>
      (segmento === 'todos' || c.taxi === (segmento === 'taxi')) &&
      (!termo || c.nome.toLowerCase().includes(termo) || c.companyid.includes(termo)))
    .sort(comparadorNulosNoFim(valor[ordem.coluna], ordem.desc));
  const ativos = clientes?.filter((c) => c.status === 'ATIVO').length ?? 0;
  const contas = clientes?.reduce((s, c) => s + c.contas, 0) ?? 0;
  const problemas = painel?.contasComProblema ?? 0;

  return (
    <>
      {erro && <p role="alert" className="text-sm text-erro-texto">{erro}</p>}

      {clientes && painel ? (
        <section
          aria-label="Resumo"
          className="entrar grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-card"
          style={{ animationDelay: '60ms' }}
        >
          <Kpi icone={Wallet} tom={TOM.marca} rotulo="Custo Meta no mês" valor={custoTotal} formatar={reais}
            detalhe={consumoFalhou ? (
              <>Não foi possível calcular. <button type="button" className="font-semibold text-blue-600 hover:underline" onClick={carregar}>Tentar de novo</button></>
            ) : consumo
              ? `estimado, de ${formatarDiaMes(consumo.periodo.de)} a ${formatarDiaMes(consumo.periodo.ate)}${consumo.total.incompleto ? ' · parte sem custo da Meta' : ''}${consumo.total.custoFasteriskBrl ? ` · Fasterisk (Taxi) ${formatarBRL(consumo.total.custoFasteriskBrl)}` : ''}`
              : 'calculando…'} />
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
            <Segmentado rotulo="Filtrar clientes" valor={segmento} onChange={setSegmento}
              opcoes={[['todos', 'Todos'], ['taxi', 'Taxi'], ['outros', 'Outros']] as const} />
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
            <RelatorioClientes />
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
                  <CabecalhoOrdenavel coluna="nome" rotulo="Cliente" ordem={ordem} onOrdenar={ordenar} className="pl-5" />
                  <CabecalhoOrdenavel coluna="contas" rotulo="Contas" ordem={ordem} onOrdenar={ordenar} className="text-right" />
                  <TableHead>Status</TableHead>
                  <CabecalhoOrdenavel coluna="enviadas" rotulo="Enviadas no mês" ordem={ordem} onOrdenar={ordenar} className="text-right" />
                  <CabecalhoOrdenavel coluna="custo" rotulo="Custo Meta no mês" ordem={ordem} onOrdenar={ordenar} className="text-right" />
                  <CabecalhoOrdenavel coluna="fasterisk" rotulo="Custo Fasterisk" ordem={ordem} onOrdenar={ordenar} className="text-right" />
                  <CabecalhoOrdenavel coluna="sync" rotulo="Último sync" ordem={ordem} onOrdenar={ordenar} />
                  <TableHead className="pr-5"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">{busca ? <>Nenhum cliente encontrado para “{busca}”.</> : 'Nenhum cliente neste filtro.'}</TableCell></TableRow>
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
                        {c.taxi && <Badge className={TOM.marca}>Taxi</Badge>}
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
                    <TableCell className="text-right text-slate-700 tabular-nums">
                      {consumoFalhou ? <span className="text-slate-400">—</span>
                        : custoDe.get(c.id) ? formatarNumero(custoDe.get(c.id)!.enviadas)
                        : <Skeleton className="ml-auto h-4 w-14" />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums"><CustoMes c={custoDe.get(c.id)} falhou={consumoFalhou} /></TableCell>
                    <TableCell className="text-right tabular-nums" title={custoDe.get(c.id)?.grupoCusto ? `Grupo ${custoDe.get(c.id)!.grupoCusto}` : undefined}>
                      {custoDe.get(c.id)?.custoFasteriskBrl ? <span className="font-semibold text-slate-800">{formatarBRL(custoDe.get(c.id)!.custoFasteriskBrl)}</span>
                        : <span className="text-slate-300">·</span>}
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
