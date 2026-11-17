import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CARTAO, PILULA, Segmentado, TituloCartao } from '@/components/shared/visual';
import { PRESETS, presetPeriodo, type Preset } from './periodo';
import { NOME_GRUPO, type FiltroAplicado, type Filtros as Opcoes } from './tipos';

interface Props {
  opcoes: Opcoes;
  valor: FiltroAplicado;
  onAplicar: (f: FiltroAplicado) => void;
  agora?: () => Date;
}

/** O Radix Select não aceita valor vazio: "todos" vira este marcador só na tela. */
const TODOS = '__todos__';

function Escolha({ id, rotulo, valor, onChange, vazio, opcoes }: {
  id: string; rotulo: string; valor: string; onChange: (v: string) => void; vazio: string; opcoes: { valor: string; texto: ReactNode }[];
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select value={valor || TODOS} onValueChange={(v) => onChange(v === TODOS ? '' : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{vazio}</SelectItem>
          {opcoes.length > 0 && <SelectSeparator />}
          {opcoes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.texto}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Os filtros só valem ao clicar em Aplicar: uma chamada recalcula a tela inteira. */
export function Filtros({ opcoes, valor, onAplicar, agora = () => new Date() }: Props) {
  const [f, setF] = useState(valor);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const set = <K extends keyof FiltroAplicado>(k: K, v: FiltroAplicado[K]) => setF((x) => ({ ...x, [k]: v }));
  const numeros = opcoes.numeros.filter((n) => !f.contaId || n.contaId === f.contaId);
  const presetAtivo = PRESETS.find((p) => {
    const r = presetPeriodo(p.id, agora(), opcoes.fuso);
    return r.de === f.de && r.ate === f.ate;
  })?.id ?? null;
  const alterado = JSON.stringify(f) !== JSON.stringify(valor);
  /** Quantos recortes além do período estão ativos (aparece no botão recolhido do celular). */
  const recortes = [f.contaId, f.numeroId, f.categoria].filter(Boolean).length;

  function aplicar() {
    if (!f.de || !f.ate) return setErro('Informe início e fim.');
    if (f.de > f.ate) return setErro('A data de início deve ser anterior ou igual à data de fim.');
    setErro(null);
    onAplicar(f);
  }

  return (
    <section className={`${CARTAO} space-y-4 p-5 print:hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloCartao icone={SlidersHorizontal} titulo="Filtros" descricao="Escolha o período e o recorte. Nada muda até clicar em Aplicar." />
        <Segmentado
          rotulo="Atalhos de período"
          opcoes={PRESETS.map((p) => [p.id, p.rotulo] as const)}
          valor={presetAtivo}
          onChange={(p: Preset) => setF((x) => ({ ...x, ...presetPeriodo(p, agora(), opcoes.fuso) }))}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {/* No celular os campos ficam recolhidos: os atalhos resolvem a maioria dos casos. */}
        <div id="filtros-campos" className={`${aberto ? 'grid' : 'hidden'} flex-1 grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-5`}>
          <Escolha id="filtro-waba" rotulo="WABA" vazio="Todas as contas" valor={f.contaId}
            onChange={(v) => setF((x) => ({ ...x, contaId: v, numeroId: '' }))}
            opcoes={opcoes.contas.map((c) => ({ valor: c.id, texto: c.nome }))} />
          <Escolha id="filtro-numero" rotulo="Número" vazio="Todos os números" valor={f.numeroId}
            onChange={(v) => set('numeroId', v)}
            opcoes={numeros.map((n) => ({ valor: n.id, texto: <span className="tabular-nums">{n.display}</span> }))} />
          <Escolha id="filtro-categoria" rotulo="Categoria" vazio="Todas as categorias" valor={f.categoria}
            onChange={(v) => set('categoria', v as FiltroAplicado['categoria'])}
            opcoes={opcoes.categorias.map((c) => ({ valor: c, texto: NOME_GRUPO[c] }))} />
          <div className="grid gap-1">
            <Label htmlFor="filtro-de">Início</Label>
            <Input id="filtro-de" type="date" aria-label="Início" value={f.de} onChange={(e) => set('de', e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filtro-ate">Fim</Label>
            <Input id="filtro-ate" type="date" aria-label="Fim" value={f.ate} onChange={(e) => set('ate', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="filtros-campos"
            onClick={() => setAberto(!aberto)}
            className="flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-slate-500 hover:text-slate-700 sm:hidden"
          >
            <ChevronDown className={`size-4 transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`} aria-hidden />
            {aberto ? 'Menos filtros' : `Mais filtros${recortes ? ` (${recortes})` : ''}`}
          </button>
          <Button className={`${PILULA} shrink-0`} onClick={aplicar}><Check aria-hidden /> Aplicar</Button>
        </div>
      </div>

      {(erro || alterado) && (
        <div className="flex flex-wrap items-center gap-3">
          {erro ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> {erro}
            </p>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="size-2 rounded-full bg-amber-500" aria-hidden /> Filtros alterados, ainda não aplicados
            </span>
          )}
        </div>
      )}
    </section>
  );
}
