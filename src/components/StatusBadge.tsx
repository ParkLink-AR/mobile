import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { BookingStatus } from '@/src/types';

const LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'PENDIENTE',
  CONFIRMED: 'CONFIRMADA',
  COMPLETED: 'FINALIZADA',
  CANCELLED: 'CANCELADA',
  EXPIRED: 'EXPIRADA',
  PENDING_OWNER_APPROVAL: 'A CONFIRMAR',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const colors = useThemeColors();
  const COLORS: Record<BookingStatus, string> = {
    PENDING_PAYMENT: colors.warning,
    CONFIRMED: colors.success,
    COMPLETED: colors.deepNavy,
    CANCELLED: colors.textSecondary,
    EXPIRED: colors.textSecondary,
    PENDING_OWNER_APPROVAL: colors.warning,
  };
  const styles = StyleSheet.create({
    badge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    text: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '700',
    },
  });
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[status] }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}
