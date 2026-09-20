import { TextStyle } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';

export type Typography = Record<'h1' | 'h2' | 'body' | 'caption', TextStyle>;

const SCALE: Record<'small' | 'medium' | 'large', number> = {
  small: 1,
  medium: 1.15,
  large: 1.3,
};

export function useTypography(): Typography {
  const colors = useThemeColors();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scale = SCALE[fontSize ?? 'large'];
  return {
    h1: { fontSize: Math.round(22 * scale), fontWeight: '700', color: colors.text },
    h2: { fontSize: Math.round(17 * scale), fontWeight: '600', color: colors.text },
    body: { fontSize: Math.round(15 * scale), fontWeight: '400', color: colors.text },
    caption: { fontSize: Math.round(13 * scale), fontWeight: '400', color: colors.textSecondary },
  };
}
