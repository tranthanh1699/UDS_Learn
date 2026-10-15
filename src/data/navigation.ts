import {
  AlertTriangle,
  BookOpen,
  Home,
  ListTree,
  type LucideIcon,
  Route,
  Settings2,
} from 'lucide-react';
import { vi, type ServiceSidKey } from '@/i18n/vi';

export interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  /** Mã SID hiển thị dạng hex, chỉ dùng cho mục service */
  sid?: ServiceSidKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Các service MVP theo thứ tự hiển thị. Thêm service mới: thêm SID vào đây và vào vi.services. */
export const MVP_SERVICES: ServiceSidKey[] = ['10', '11', '19', '22', '27', '2E', '3E'];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: vi.nav.groupOverview,
    items: [
      { to: '/', label: vi.nav.home, icon: Home },
      { to: '/config', label: vi.nav.config, icon: Settings2 },
    ],
  },
  {
    label: vi.nav.groupServices,
    items: MVP_SERVICES.map((sid) => ({ to: `/service/${sid}`, label: vi.services[sid].name, sid })),
  },
  {
    label: vi.nav.groupTools,
    items: [
      { to: '/faults', label: vi.nav.faults, icon: AlertTriangle },
      { to: '/trace', label: vi.nav.trace, icon: ListTree },
      { to: '/nrc', label: vi.nav.nrc, icon: BookOpen },
      { to: '/scenarios', label: vi.nav.scenarios, icon: Route },
    ],
  },
];
