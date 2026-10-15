import { HashRouter, Route, Routes } from 'react-router-dom';
import { vi } from '@/i18n/vi';
import { AppLayout } from '@/components/layout/AppLayout';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ConfigPage } from '@/pages/ConfigPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ServicePage } from '@/pages/ServicePage';

const pg = vi.pages;

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
            <Route path="faults" element={<PlaceholderPage title={pg.faults.title} subtitle={pg.faults.subtitle} phase={7} />} />
            <Route path="trace" element={<PlaceholderPage title={pg.trace.title} subtitle={pg.trace.subtitle} phase={8} />} />
            <Route path="nrc" element={<PlaceholderPage title={pg.nrc.title} subtitle={pg.nrc.subtitle} phase={8} />} />
            <Route path="scenarios" element={<PlaceholderPage title={pg.scenarios.title} subtitle={pg.scenarios.subtitle} phase={8} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  );
}
