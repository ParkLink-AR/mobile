import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { t } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';
import { SettlementStatus } from '@/src/types';

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  const colors = useThemeColors();
  const scale = useScale();
  const LABELS: Record<SettlementStatus, string> = {
    PENDING: t('settlements.status.pending'),
    PAID: t('settlements.status.paid'),
  };
  const COLORS: Record<SettlementStatus, string> = {
    PENDING: colors.warning,
    PAID: colors.success,
  };
  const styles = StyleSheet.create({
    badge: {
      borderRadius: 6,
      paddingHorizontal: Math.round(8 * scale),
      paddingVertical: Math.round(2 * scale),
      alignSelf: 'flex-start',
    },
    text: {
      color: colors.white,
      fontSize: Math.round(11 * scale),
      fontWeight: '700',
    },
  });
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[status] }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}
