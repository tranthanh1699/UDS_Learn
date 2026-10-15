import { Outlet } from 'react-router-dom';
import { useEcuClock } from '@/hooks/useEcuClock';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';

export function AppLayout() {
  useEcuClock();
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
