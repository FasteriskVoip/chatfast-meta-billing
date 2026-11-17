import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Carregando } from '@/components/shared/Acesso';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardApp'));
const Admin = lazy(() => import('@/features/admin/AdminApp'));

function Rota() {
  const caminho = window.location.pathname.replace(/\/+$/, '');
  if (caminho === '/dashboard') return <Dashboard />;
  if (caminho === '/admin') return <Admin />;
  return <p className="p-8 text-center text-sm text-slate-500">Página não encontrada.</p>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={150}>
      <Suspense fallback={<Carregando texto="Carregando…" />}>
        <Rota />
      </Suspense>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  </StrictMode>,
);
