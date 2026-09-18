import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getBookingApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';
import { Booking } from '@/src/types';

/** Maps the backend wire shape to the UI Booking type -- same mapping as the
 * driver's booking list (see (tabs)/bookings.tsx), plus payment_id/updated_at
 * which the list doesn't need but the detail view does. */
function mapApiBooking(b: BookingApiResponse, spotTitle: string): Booking {
  const start = new Date(b.start);
  const end = new Date(b.end);
  const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / 3_600_000));
  const dateISO = b.start.slice(0, 10);
  const startTime = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0;

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: spotTitle,
    driverId: b.user_id,
    driverName: '',
    ownerId: '',
    date: dateISO,
    startTime,
    endTime,
    hours,
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    status: b.status as Booking['status'],
    paymentId: b.payment_id,
    confirmedAt: b.updated_at,
    verificationCode: b.verification_code,
  };
}

export default function DriverBookingDetail() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBookingApi(id)
      .then(async (raw) => {
        const spot = await getParkingSpotDetail(raw.parking_spot_id).catch(() => null);
        setBooking(mapApiBooking(raw, spot?.title ?? raw.parking_spot_id));
      })
      .catch((err) => {
        console.warn('[BookingDetail] fetch error:', err);
        setError(true);
      });
  }, [id]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { fontSize: 13, color: colors.textSecondary },
    detailValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
    codeCard: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.teal,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      gap: 4,
    },
    codeLabel: { fontSize: 12, color: colors.textSecondary },
    codeValue: { fontSize: 32, fontWeight: '700', color: colors.teal, letterSpacing: 6 },
    codeHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  });

  if (error) {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t('driver.booking.detail.error')}</Text>
        </View>
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
      </Screen>
    );
  }

  const confirmedDate = booking.confirmedAt ? new Date(booking.confirmedAt) : null;

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Card>
        <View style={styles.row}>
          <Text style={typography.h1}>{booking.parkingSpotTitle}</Text>
          <StatusBadge status={booking.status} />
        </View>

        {booking.status === 'CONFIRMED' && booking.verificationCode && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>{t('driver.booking.codeLabel')}</Text>
            <Text style={styles.codeValue}>{booking.verificationCode}</Text>
            <Text style={styles.codeHint}>{t('driver.booking.codeHint')}</Text>
          </View>
        )}

        <Text style={typography.body}>
          {booking.date} · {booking.startTime} {t('driver.booking.timeTo')} {booking.endTime}
        </Text>
        <Text style={typography.body}>{t('driver.booking.total')}: ${booking.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>

        {(booking.paymentId || confirmedDate) && (
          <>
            <View style={styles.divider} />
            {confirmedDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('driver.booking.detail.paidAt')}</Text>
                <Text style={styles.detailValue}>
                  {confirmedDate.toLocaleDateString('es-AR')} · {confirmedDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {booking.paymentId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('driver.booking.detail.paymentRef')}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{booking.paymentId}</Text>
              </View>
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}
