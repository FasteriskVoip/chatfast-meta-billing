import { useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, mensagemDeErro } from '@/lib/api';

/** Excel vem do backend (3 abas); PDF é a impressão do próprio dashboard (research R-10). */
export function BotoesExportar({ params }: { params: Record<string, string> }) {
  const [baixando, setBaixando] = useState(false);

  async function excel() {
    setBaixando(true);
    try {
      const r = await api.get<Blob>('/dashboard/exportar.xlsx', { params, responseType: 'blob' });
      const nome = /filename="([^"]+)"/.exec(String(r.headers['content-disposition']))?.[1] ?? 'consumo.xlsx';
      const url = URL.createObjectURL(r.data);
      const a = Object.assign(document.createElement('a'), { href: url, download: nome });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={excel} disabled={baixando}>
        <FileSpreadsheet className="text-emerald-600" aria-hidden /> {baixando ? 'Gerando…' : 'Excel'}
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="text-blue-600" aria-hidden /> PDF
      </Button>
    </div>
  );
}
