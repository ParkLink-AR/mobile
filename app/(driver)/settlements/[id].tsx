import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, View, Image, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { SettlementStatusBadge } from '@/src/components/SettlementStatusBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getSettlementById } from '@/src/services/paymentService';
import { getBookingApi } from '@/src/api/booking';
import { formatFullDateTime, mapBookingDateRange, formatBookingWhen } from '@/src/services/bookingDates';
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
    const when = formatBookingWhen(range, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'));
    return { ...payout, when };
  } catch {
    return { ...payout, when: null };
  }
}

export default function SettlementDetail() {
  useLanguage();
  const colors = useThemeColors();
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
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    amount: { color: colors.teal, fontWeight: '700', fontSize: 24, marginTop: 4 },
    preparingNote: { marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { fontSize: 14, color: colors.textSecondary },
    rowValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
    sectionTitle: { marginTop: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    proofImage: { width: '100%', height: 220, borderRadius: 10, backgroundColor: colors.background },
    noProofText: { fontSize: 13, color: colors.textSecondary },
    bookingWhen: { fontSize: 14, color: colors.text, fontWeight: '600' },
  });

  if (error) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
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
            ? `${t('settlements.paidAt')} ${settlement.paidAt ? formatFullDateTime(settlement.paidAt) : '—'}`
            : `${t('settlements.preparedAt')} ${formatFullDateTime(settlement.createdAt)}`}
        </Text>
        {settlement.status === 'PENDING' && (
          <Text style={[typography.caption, styles.preparingNote]}>{t('settlements.preparingNote')}</Text>
        )}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settlements.grossAmount')}</Text>
          <Text style={styles.rowValue}>{money(settlement.grossAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settlements.commissionLabel')}</Text>
          <Text style={styles.rowValue}>{money(settlement.commissionAmount)}</Text>
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.sectionLabel}>{t('settlements.proofTitle')}</Text>
        </View>
        {settlement.proofUrl ? (
          <Image source={{ uri: settlement.proofUrl }} style={styles.proofImage} resizeMode="contain" />
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
            <Text style={typography.caption}>{money(item.netAmount)}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}
