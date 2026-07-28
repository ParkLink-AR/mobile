import { useThemeStore } from '@/src/store/useThemeStore';
import { palettes } from '@/src/theme/colors';
import { ColorPalette } from '@/src/theme/types';

export function useThemeColors(): ColorPalette {
  const mode = useThemeStore((s) => s.mode);
  return palettes[mode];
}
