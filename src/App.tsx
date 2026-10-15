import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ConfigPage } from '@/pages/ConfigPage';
import { FaultsPage } from '@/pages/FaultsPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { NrcPage } from '@/pages/NrcPage';
import { ScenariosPage } from '@/pages/ScenariosPage';
import { ServicePage } from '@/pages/ServicePage';
import { TracePage } from '@/pages/TracePage';

// HashRouter: dist/ chạy được trên mọi web server tĩnh mà không cần cấu hình rewrite.
export function App() {
  return (
    <TooltipProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="service/:sid" element={<ServicePage />} />
            <Route path="faults" element={<FaultsPage />} />
            <Route path="trace" element={<TracePage />} />
            <Route path="nrc" element={<NrcPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  );
}
