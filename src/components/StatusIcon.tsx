import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';

type StatusIconVariant = 'success' | 'error' | 'unknown';

const ICON_BY_VARIANT: Record<StatusIconVariant, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  unknown: 'help-circle',
};

interface StatusIconProps {
  variant: StatusIconVariant;
  size?: number;
}

/**
 * Circular tinted badge + icon for confirmation/result screens (booking
 * success, payment approved/rejected/unknown, registration complete) --
 * replaces the plain "✓"/"✗"/"?" text glyphs those screens used to render,
 * which looked like an unstyled placeholder rather than a finished screen.
 */
export function StatusIcon({ variant, size = 72 }: StatusIconProps) {
  const colors = useThemeColors();
  const color = variant === 'success' ? colors.teal : variant === 'error' ? colors.warning : colors.textSecondary;

  const styles = StyleSheet.create({
    wrap: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.wrap}>
      <Ionicons name={ICON_BY_VARIANT[variant]} size={size * 0.72} color={color} />
    </View>
  );
}
