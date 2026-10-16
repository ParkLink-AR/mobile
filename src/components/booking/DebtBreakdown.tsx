import { t, useLanguage } from '@/src/i18n';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { debtBookingDay, formatDebtPesos, type Debt } from '@/src/services/debts';

/**
 * What a payment is made of when the booking also carries the driver's pending balances: the
 * booking's own price, one line per balance (where the extra time was, which booking, how many
 * minutes) and the total they will be charged. Transparency is the point -- nothing is added to
 * a payment without showing why.
 *
 * Without balances it is just the total row, so the confirmation screens render it unconditionally.
 */
export function DebtBreakdown({ bookingTotal, debts }: { bookingTotal: number | null; debts: Debt[] }) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const owed = debts.reduce((total, debt) => total + debt.amount, 0);
  const hasDebts = debts.length > 0 && bookingTotal !== null;

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    label: { flex: 1, fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(19) },
    value: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    divider: { height: 1, backgroundColor: colors.border },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: sc(18), color: colors.teal, fontWeight: '700' },
    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    noteText: { flex: 1, fontSize: sc(12), color: colors.textSecondary, lineHeight: sc(17) },
    group: { gap: 8 },
  });

  const total = bookingTotal === null ? null : bookingTotal + owed;

  if (!hasDebts) {
    return (
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('driver.booking.total')}</Text>
        <Text style={styles.totalValue}>{total !== null ? formatDebtPesos(total) : '—'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('debts.breakdown.booking')}</Text>
        <Text style={styles.value}>{formatDebtPesos(bookingTotal)}</Text>
      </View>
      {debts.map((debt) => (
        <View key={debt.id} style={styles.row}>
          <Text style={styles.label}>
            {debt.spotTitle
              ? t('debts.breakdown.line', {
                  spot: debt.spotTitle, date: debtBookingDay(debt), minutes: String(debt.minutes),
                })
              : t('debts.breakdown.lineNoSpot', { date: debtBookingDay(debt), minutes: String(debt.minutes) })}
          </Text>
          <Text style={styles.value}>{formatDebtPesos(debt.amount)}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('debts.breakdown.total')}</Text>
        <Text style={styles.totalValue}>{formatDebtPesos(total!)}</Text>
      </View>
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={sc(15)} color={colors.textSecondary} />
        <Text style={styles.noteText}>{t('debts.breakdown.note')}</Text>
      </View>
    </View>
  );
}
