import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

// Bordered surface box for grouping related info -- the look every screen
// should use for this (radius 14, 1px border, no shadow/elevation). Matches
// what owner/spots/[id]/edit.tsx already used locally as `infoCard`/`card`;
// this is now the one shared definition instead of screens redefining it
// with slightly different values.
export function Card({ children, style }: CardProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
  });
  return <View style={[styles.card, style]}>{children}</View>;
}
