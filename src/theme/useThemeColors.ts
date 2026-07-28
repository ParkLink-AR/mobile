import { palettes } from '@/src/theme/colors';
import { ColorPalette } from '@/src/theme/types';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useThemeStore } from '@/src/store/useThemeStore';

export function useThemeColors(): ColorPalette {
  // prefer settings store if available; fallback to legacy theme store
  const mode = useSettingsStore((s) => s.mode) ?? useThemeStore((s) => s.mode);
  return palettes[mode];
}
