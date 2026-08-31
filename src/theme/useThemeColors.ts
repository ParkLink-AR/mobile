import { palettes } from '@/src/theme/colors';
import { ColorPalette } from '@/src/theme/types';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useThemeStore } from '@/src/store/useThemeStore';

export function useThemeColors(): ColorPalette {
  // Both hooks must be called unconditionally (Rules of Hooks). useSettingsStore
  // is the source of truth; useThemeStore is the legacy fallback — we always read
  // both and pick whichever is non-null.
  const settingsMode = useSettingsStore((s) => s.mode);
  const themeMode = useThemeStore((s) => s.mode);
  return palettes[settingsMode ?? themeMode];
}
