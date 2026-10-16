import { t, useLanguage } from '@/src/i18n';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { debtBookingDay, formatDebtPesos, useMyDebts, type Debt } from '@/src/services/debts';
import { formatShortDateFromISO } from '@/src/services/bookingDates';

/**
 * "Saldos pendientes": what the driver owes for staying past the end of a booking, why, and
 * where each balance stands. A balance is charged with the next reservation -- it never blocks
 * one -- and the confirmation itemises it before they pay.
 */
export default function Debts() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const { loading, debts, pending } = useMyDebts();

  const open = debts.filter((debt) => debt.status !== 'PAID');
  const settled = debts.filter((debt) => debt.status === 'PAID');

  const styles = StyleSheet.create({
    body: { padding: 16, gap: 14 },
    intro: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(19) },
    totalCard: { gap: 4 },
    totalLabel: { fontSize: sc(12), fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
    totalValue: { fontSize: sc(26), fontWeight: '800', color: colors.teal },
    sectionLabel: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4,
    },
    item: { gap: 8 },
    itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    amount: { fontSize: sc(18), fontWeight: '700', color: colors.text },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: sc(12), fontWeight: '700' },
    origin: { fontSize: sc(14), color: colors.text, lineHeight: sc(20) },
    note: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    linkText: { fontSize: sc(13), fontWeight: '600', color: colors.teal },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
    emptyText: { fontSize: sc(14), color: colors.textSecondary, textAlign: 'center' },
  });

  function chipColor(status: Debt['status']): string {
    return status === 'PAID' ? colors.teal : colors.warning;
  }

  function renderDebt(debt: Debt) {
    return (
      <Card key={debt.id}>
        <View style={styles.item}>
          <View style={styles.itemHeader}>
            <Text style={styles.amount}>{formatDebtPesos(debt.amount)}</Text>
            <View style={[styles.chip, { borderColor: chipColor(debt.status) }]}>
              <Text style={[styles.chipText, { color: chipColor(debt.status) }]}>{t(`debts.status.${debt.status}`)}</Text>
            </View>
          </View>
          <Text style={styles.origin}>
            {debt.spotTitle
              ? t('debts.item.origin', { minutes: String(debt.minutes), spot: debt.spotTitle, date: debtBookingDay(debt) })
              : t('debts.item.originNoSpot', { minutes: String(debt.minutes), date: debtBookingDay(debt) })}
          </Text>
          {debt.status === 'PENDING' && <Text style={styles.note}>{t('debts.item.pendingNote')}</Text>}
          {debt.status === 'RESERVED' && <Text style={styles.note}>{t('debts.item.reservedNote')}</Text>}
          {debt.status === 'PAID' && debt.paidAt && (
            <Text style={styles.note}>{t('debts.item.paidNote', { date: formatShortDateFromISO(debt.paidAt) })}</Text>
          )}
          <Pressable style={styles.link} onPress={() => router.push(`${group}/bookings/${debt.bookingId}` as never)}>
            <Ionicons name="receipt-outline" size={sc(15)} color={colors.teal} />
            <Text style={styles.linkText}>{t('debts.item.seeOrigin')}</Text>
          </Pressable>
          {debt.chargedBookingId && (
            <Pressable style={styles.link} onPress={() => router.push(`${group}/bookings/${debt.chargedBookingId}` as never)}>
              <Ionicons name="card-outline" size={sc(15)} color={colors.teal} />
              <Text style={styles.linkText}>{t('debts.item.seePayer')}</Text>
            </Pressable>
          )}
        </View>
      </Card>
    );
  }

  return (
    <Screen style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <Text style={styles.intro}>{t('debts.screen.intro')}</Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : debts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={sc(40)} color={colors.teal} />
              <Text style={styles.emptyText}>{t('debts.screen.empty')}</Text>
            </View>
          ) : (
            <>
              {pending > 0 && (
                <Card>
                  <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>{t('debts.screen.pendingTotal')}</Text>
                    <Text style={styles.totalValue}>{formatDebtPesos(pending)}</Text>
                  </View>
                </Card>
              )}
              {open.map(renderDebt)}
              {settled.length > 0 && <Text style={styles.sectionLabel}>{t('debts.screen.history')}</Text>}
              {settled.map(renderDebt)}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
