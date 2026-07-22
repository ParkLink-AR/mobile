import { useThemeStore } from '@/src/store/useThemeStore';
import { palettes, ColorPalette } from '@/src/theme/colors';

export function useThemeColors(): ColorPalette {
  const mode = useThemeStore((s) => s.mode);
  return palettes[mode];
}
