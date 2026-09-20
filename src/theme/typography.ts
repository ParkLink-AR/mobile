import { TextStyle } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';

export type Typography = Record<'h1' | 'h2' | 'body' | 'caption', TextStyle>;

export const FONT_SCALE: Record<'small' | 'medium' | 'large', number> = {
  small: 0.78,
  medium: 1,
  large: 1.89,
};

/** Returns the current numeric scale factor (e.g. 1.89 for large). */
export function useScale(): number {
  const fontSize = useSettingsStore((s) => s.fontSize);
  return FONT_SCALE[fontSize ?? 'large'];
}

export function useTypography(): Typography {
  const colors = useThemeColors();
  const scale = useScale();
  return {
    h1: { fontSize: Math.round(24 * scale), fontWeight: '700', color: colors.text, lineHeight: Math.round(24 * scale * 1.25) },
    h2: { fontSize: Math.round(18 * scale), fontWeight: '600', color: colors.text, lineHeight: Math.round(18 * scale * 1.3) },
    body: { fontSize: Math.round(15 * scale), fontWeight: '400', color: colors.text, lineHeight: Math.round(15 * scale * 1.5) },
    caption: { fontSize: Math.round(13 * scale), fontWeight: '400', color: colors.textSecondary, lineHeight: Math.round(13 * scale * 1.45) },
  };
}
