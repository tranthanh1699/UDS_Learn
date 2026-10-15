import { create } from 'zustand';
import { loadString, saveString } from '@/lib/storage';

export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const initialTheme: Theme = loadString('theme') === 'light' ? 'light' : 'dark';

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  sidebarCollapsed: loadString('sidebarCollapsed') === '1',
  mobileNavOpen: false,
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    saveString('theme', theme);
    set({ theme });
  },
  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    saveString('sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    set({ sidebarCollapsed });
  },
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
