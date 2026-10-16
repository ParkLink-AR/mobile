import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { SettlementStatusBadge } from '@/src/components/SettlementStatusBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { getSettlementById } from '@/src/services/paymentService';
import { getBookingApi } from '@/src/api/booking';
import { formatLongDateTime, mapBookingDateRange, formatBookingWhen } from '@/src/services/bookingDates';
import { Settlement, SettlementPayout } from '@/src/types';

function money(centavos: number): string {
  return `$${(centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PayoutRow extends SettlementPayout {
  // The booking's date range formatted for display, when it could be resolved.
  // null falls back to showing the raw bookingId -- see resolvePayoutRow.
  when: string | null;
}

/**
 * Enriches a settlement's payout with its booking's date range by reusing the
 * existing single-booking lookup (GET /bookings/{id}, already called by the
 * booking-detail screen for both driver and owner views) -- no new backend
 * endpoint needed for this. Falls back to `when: null` (id + amount only) if
 * that lookup fails, e.g. an edge-case/old booking.
 */
async function resolvePayoutRow(payout: SettlementPayout): Promise<PayoutRow> {
  try {
    const booking = await getBookingApi(payout.bookingId);
    const range = mapBookingDateRange(booking.start, booking.end);
    const when = formatBookingWhen(range, t('driver.booking.timeTo'));
    return { ...payout, when };
  } catch {
    return { ...payout, when: null };
  }
}

export default function SettlementDetail() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [payoutRows, setPayoutRows] = useState<PayoutRow[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSettlementById(id)
      .then(async (s) => {
        setSettlement(s);
        const rows = await Promise.all((s.payouts ?? []).map(resolvePayoutRow));
        setPayoutRows(rows);
      })
      .catch((err) => {
        console.warn('[SettlementDetail] fetch error:', err);
        setError(true);
      });
  }, [id]);

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    errorText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    amount: { color: colors.teal, fontWeight: '700', fontSize: sc(24), marginTop: 4 },
    preparingNote: { marginTop: 4 },
    sectionTitle: { marginTop: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionLabel: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    viewProofBtn: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16 },
    noProofText: { fontSize: sc(13), color: colors.textSecondary },
    bookingWhen: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
  });

  if (error) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={sc(40)} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t('settlements.detail.error')}</Text>
        </View>
      </Screen>
    );
  }

  if (!settlement) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.amount}>{money(settlement.netAmount)}</Text>
          <SettlementStatusBadge status={settlement.status} />
        </View>
        <Text style={typography.caption}>
          {settlement.status === 'PAID'
            ? `${t('settlements.paidAt')} ${settlement.paidAt ? formatLongDateTime(settlement.paidAt) : '—'}`
            : `${t('settlements.preparedAt')} ${formatLongDateTime(settlement.createdAt)}`}
        </Text>
        {settlement.status === 'PENDING' && (
          <Text style={[typography.caption, styles.preparingNote]}>{t('settlements.preparingNote')}</Text>
        )}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt-outline" size={sc(15)} color={colors.textSecondary} />
          <Text style={styles.sectionLabel}>{t('settlements.proofTitle')}</Text>
        </View>
        {settlement.proofUrl ? (
          <Button
            title={t('settlements.viewProof')}
            onPress={() => WebBrowser.openBrowserAsync(settlement.proofUrl!)}
            style={styles.viewProofBtn}
          />
        ) : (
          <Text style={styles.noProofText}>
            {settlement.status === 'PENDING' ? t('settlements.proofPending') : t('settlements.noProof')}
          </Text>
        )}
      </Card>

      <Text style={[typography.caption, styles.sectionTitle]}>{t('settlements.bookingsIncluded')}</Text>
      <FlatList
        data={payoutRows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={payoutRows.length === 0 ? { gap: 8, flexGrow: 1 } : { gap: 8 }}
        ListEmptyComponent={<Text style={styles.noProofText}>{t('settlements.bookingsEmpty')}</Text>}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.bookingWhen}>{item.when ?? item.bookingId}</Text>
            {item.kind === 'OVERSTAY' && <Text style={typography.caption}>{t('settlements.overstayLabel')}</Text>}
            <Text style={typography.caption}>{money(item.netAmount)}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}
