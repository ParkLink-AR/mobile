import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
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
      borderRadius: 16,
      padding: 14,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        android: { elevation: 3 },
      }),
    },
  });
  return <View style={[styles.card, style]}>{children}</View>;
}
