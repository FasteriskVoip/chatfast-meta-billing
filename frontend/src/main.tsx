import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { EsqueletoAdmin, EsqueletoDashboard } from '@/components/shared/Esqueletos';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardApp'));
const Admin = lazy(() => import('@/features/admin/AdminApp'));

function Rota() {
  const caminho = window.location.pathname.replace(/\/+$/, '');
  if (caminho === '/dashboard') return <Suspense fallback={<EsqueletoDashboard />}><Dashboard /></Suspense>;
  if (caminho === '/admin') return <Suspense fallback={<EsqueletoAdmin />}><Admin /></Suspense>;
  return <p className="p-8 text-center text-sm text-slate-500">Página não encontrada.</p>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={150}>
      <Rota />
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  </StrictMode>,
);
