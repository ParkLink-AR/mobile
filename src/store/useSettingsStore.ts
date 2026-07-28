import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from '@/src/theme/types';
import i18n from '@/src/i18n';

export type Language = 'es' | 'en' | 'ja';

interface SettingsState {
  language: Language;
  setLanguage: (l: Language) => void;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

export const useSettingsStore = create(
  persist<SettingsState>(
    (set) => ({
      language: 'es',
      setLanguage: (l) => {
        i18n.setLanguage(l);
        set({ language: l });
      },
      mode: 'light',
      setMode: (m) => set({ mode: m }),
      toggleMode: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'settings-storage',
      getStorage: () => AsyncStorage,
    }
  )
);

// initialize i18n language from persisted store and subscribe to changes
try {
  const currentLang = useSettingsStore.getState().language;
  i18n.setLanguage(currentLang);
  useSettingsStore.subscribe((s) => i18n.setLanguage(s.language));
} catch (e) {
  // ignore during SSR or if AsyncStorage not ready
}
