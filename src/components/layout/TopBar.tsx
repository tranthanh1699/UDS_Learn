import { Menu, Moon, Search, Sun } from 'lucide-react';
import { vi } from '@/i18n/vi';
import { useUiStore } from '@/store/ui';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { Logo } from './Logo';

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const themeLabel = theme === 'dark' ? vi.theme.toLight : vi.theme.toDark;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 backdrop-blur sm:px-4">
      <IconButton className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={vi.nav.openMenu}>
        <Menu className="h-5 w-5" />
      </IconButton>
      <div className="lg:hidden">
        <Logo />
      </div>
      <div className="hidden text-sm text-muted lg:block">{vi.app.tagline}</div>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={vi.palette.open}
          className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs text-muted hover:text-fg"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{vi.palette.open}</span>
        </button>
        <Tooltip content={themeLabel} side="bottom">
          <IconButton onClick={toggleTheme} aria-label={themeLabel}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
}
