import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
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
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    spotTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },

    cardContent: { gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },

    divider: { height: 1, backgroundColor: colors.border },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
    detailValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: 18, color: colors.teal, fontWeight: '700' },

    codeCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.teal,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      gap: 4,
    },
    codeLabel: { fontSize: 12, color: colors.textSecondary },
    codeValue: { fontSize: 32, fontWeight: '700', color: colors.teal, letterSpacing: 6 },
    codeHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  });

  if (error) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t('driver.booking.detail.error')}</Text>
        </View>
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
      </Screen>
    );
  }

  const confirmedDate = booking.confirmedAt ? new Date(booking.confirmedAt) : null;
  const dateLabel = new Date(`${booking.date}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Hero: cochera + estado de la reserva */}
          <View style={styles.heroCard}>
            <View style={styles.titleRow}>
              <Text style={styles.spotTitle}>{booking.parkingSpotTitle}</Text>
              <StatusBadge status={booking.status} />
            </View>
          </View>

          {booking.status === 'CONFIRMED' && booking.verificationCode && (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>{t('driver.booking.codeLabel')}</Text>
              <Text style={styles.codeValue}>{booking.verificationCode}</Text>
              <Text style={styles.codeHint}>{t('driver.booking.codeHint')}</Text>
            </View>
          )}

          {/* Resumen: fecha, horario y total */}
          <Card>
            <View style={styles.cardContent}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.summary')}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.date')}</Text>
                <Text style={styles.detailValue}>{dateLabel}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.time')}</Text>
                <Text style={styles.detailValue}>
                  {booking.startTime} {t('driver.booking.timeTo')} {booking.endTime}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('driver.booking.total')}</Text>
                <Text style={styles.totalValue}>
                  ${booking.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </Card>

          {/* Pago: solo si ya hay algo que mostrar */}
          {(booking.paymentId || confirmedDate) && (
            <Card>
              <View style={styles.cardContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="card-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.sectionLabel}>{t('driver.booking.detail.paymentSection')}</Text>
                </View>

                {confirmedDate && (
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('driver.booking.detail.paidAt')}</Text>
                    <Text style={styles.detailValue}>
                      {confirmedDate.toLocaleDateString('es-AR')} · {confirmedDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
                {booking.paymentId && (
                  <View style={styles.detailRow}>
                    <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('driver.booking.detail.paymentRef')}</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>{booking.paymentId}</Text>
                  </View>
                )}
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
