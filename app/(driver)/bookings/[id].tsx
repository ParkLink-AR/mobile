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
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';
import { getBookingApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';
import { getPublicProfileApi } from '@/src/api/auth';
import { mapBookingDateRange, formatBookingWhen } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';

/** Maps the backend wire shape to the UI Booking type -- same mapping as the
 * driver's booking list (see (tabs)/bookings.tsx), plus payment_id/updated_at
 * which the list doesn't need but the detail view does. */
function mapApiBooking(b: BookingApiResponse, spotTitle: string): Booking {
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0;

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: spotTitle,
    driverId: b.user_id,
    driverName: '',
    ownerId: '',
    kind: b.kind,
    ...mapBookingDateRange(b.start, b.end),
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    status: b.status as Booking['status'],
    paymentId: b.payment_id,
    confirmedAt: b.updated_at,
    verificationCode: b.verification_code,
  };
}

/** Duración legible: horas para HOURLY, días de check-in a check-out para STAY. */
function durationLabel(booking: Booking): string {
  if (booking.kind === 'HOURLY') {
    return t('driver.booking.durationHours', { hours: String(booking.hours) });
  }
  const days = Math.max(1, Math.round(
    (new Date(`${booking.endDate}T00:00:00`).getTime() - new Date(`${booking.date}T00:00:00`).getTime()) / 86_400_000,
  ));
  return t('driver.booking.durationDays', { days: String(days) });
}

export default function DriverBookingDetail() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeMode = useAccountTypeStore((s) => s.activeMode);
  const isOwnerView = activeMode === 'owner';
  const accent = isOwnerView ? colors.ownerAccent : colors.teal;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBookingApi(id)
      .then(async (raw) => {
        const spot = await getParkingSpotDetail(raw.parking_spot_id).catch(() => null);
        setBooking(mapApiBooking(raw, spot?.title ?? raw.parking_spot_id));
        if (isOwnerView) {
          getPublicProfileApi(raw.user_id)
            .then((profile) => setDriverName(profile.name))
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[BookingDetail] fetch error:', err);
        setError(true);
      });
  }, [id, isOwnerView]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { fontSize: 13, color: colors.textSecondary },
    detailValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
    kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    kindText: { fontSize: 13, fontWeight: '600', color: accent },
    codeCard: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: accent,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      gap: 4,
    },
    codeLabel: { fontSize: 12, color: colors.textSecondary },
    codeValue: { fontSize: 32, fontWeight: '700', color: accent, letterSpacing: 6 },
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
        <ActivityIndicator style={{ marginTop: 40 }} color={accent} />
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

        <View style={styles.kindRow}>
          <Ionicons name={booking.kind === 'STAY' ? 'calendar-outline' : 'time-outline'} size={14} color={accent} />
          <Text style={styles.kindText}>
            {t(booking.kind === 'STAY' ? 'driver.booking.kind.stay' : 'driver.booking.kind.hourly')}
          </Text>
        </View>

        {isOwnerView && driverName && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('driver.booking.detail.driver')}</Text>
            <Text style={styles.detailValue}>{driverName}</Text>
          </View>
        )}

        {booking.status === 'CONFIRMED' && booking.verificationCode && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>{t('driver.booking.codeLabel')}</Text>
            <Text style={styles.codeValue}>{booking.verificationCode}</Text>
            <Text style={styles.codeHint}>{t('driver.booking.codeHint')}</Text>
          </View>
        )}

        <Text style={typography.body}>{formatBookingWhen(booking, t('driver.booking.timeTo'))}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('driver.booking.detail.duration')}</Text>
          <Text style={styles.detailValue}>{durationLabel(booking)}</Text>
        </View>

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
