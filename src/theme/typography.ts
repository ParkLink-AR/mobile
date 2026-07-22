import { TextStyle } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';

export type Typography = Record<'h1' | 'h2' | 'body' | 'caption', TextStyle>;

export function useTypography(): Typography {
  const colors = useThemeColors();
  return {
    h1: { fontSize: 22, fontWeight: '700', color: colors.text },
    h2: { fontSize: 17, fontWeight: '600', color: colors.text },
    body: { fontSize: 15, fontWeight: '400', color: colors.text },
    caption: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  };
}
