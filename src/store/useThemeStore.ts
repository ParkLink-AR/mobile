import { create } from 'zustand';
import { ThemeMode } from '@/src/theme/colors';

interface ThemeState {
  mode: ThemeMode;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  toggleMode: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
}));
