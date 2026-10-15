import { AnimatePresence, motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NAV_GROUPS, type NavItem } from '@/data/navigation';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/store/ui';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { Logo } from './Logo';

function NavEntry({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
          isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {item.sid ? (
        <span className="hex w-8 shrink-0 rounded bg-surface-2 px-1 py-0.5 text-center text-[11px] font-semibold text-byte-sid">
          {item.sid}
        </span>
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted/80">
              {group.label}
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavEntry key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <>
      {/* Laptop/desktop: thanh bên cố định, có thể thu gọn */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-border px-3', collapsed && 'justify-center px-0')}>
          {!collapsed && <Logo />}
          <IconButton
            onClick={toggleSidebar}
            className={cn(!collapsed && 'ml-auto')}
            aria-label={collapsed ? vi.nav.expand : vi.nav.collapse}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </IconButton>
        </div>
        <NavContent collapsed={collapsed} />
      </aside>

      {/* Tablet: thanh bên dạng overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              <div className="flex h-14 items-center border-b border-border px-3">
                <Logo />
                <IconButton className="ml-auto" onClick={() => setMobileOpen(false)} aria-label={vi.nav.closeMenu}>
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
              <NavContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
