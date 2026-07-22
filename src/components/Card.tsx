import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
  return <View style={[styles.card, style]}>{children}</View>;
}
