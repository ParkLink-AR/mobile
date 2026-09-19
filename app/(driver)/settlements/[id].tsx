import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getSettlementById } from '@/src/services/paymentService';
import { getBookingById } from '@/src/services/bookingService';
import { Booking, Settlement } from '@/src/types';

export default function SettlementDetail() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    getSettlementById(id).then(async (s) => {
      if (!s) return;
      setSettlement(s);
      const resolved = await Promise.all(s.bookingIds.map((bid) => getBookingById(bid)));
      setBookings(resolved.filter((b): b is Booking => !!b));
    });
  }, [id]);

  if (!settlement) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
    amount: { color: colors.ownerAccent, fontWeight: '700', fontSize: 24, marginTop: 4 },
    sectionTitle: { marginTop: 8 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Card>
        <Text style={typography.h1}>{settlement.period}</Text>
        <Text style={styles.amount}>${settlement.totalAmount.toLocaleString('es-AR')}</Text>
        <Text style={typography.caption}>
          {t('settlements.commission', { amount: settlement.commissionRetained.toLocaleString('es-AR') })}
        </Text>
      </Card>
      <Text style={[typography.caption, styles.sectionTitle]}>{t('settlements.bookingsIncluded')}</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={typography.body}>{item.driverName}</Text>
            <Text style={typography.caption}>
              {item.date} · {item.startTime} {t('driver.booking.timeTo')} {item.endTime} · ${item.subtotal}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
