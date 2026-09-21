import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';
import { getBookingApi, cancelBookingApi, BookingApiResponse } from '@/src/api/booking';
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
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeMode = useAccountTypeStore((s) => s.activeMode);
  const isOwnerView = activeMode === 'owner';
  const [booking, setBooking] = useState<Booking | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  function handleCancel() {
    if (!booking) return;
    Alert.alert(
      t('driver.booking.cancel.title'),
      t('driver.booking.cancel.confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('driver.booking.cancel.yes'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const updated = await cancelBookingApi(booking.id);
              setBooking((prev) => prev ? { ...prev, status: updated.status as Booking['status'] } : prev);
            } catch (err: any) {
              const msg = err?.detail ?? err?.message ?? t('driver.booking.detail.error');
              Alert.alert(t('driver.booking.cancel.title'), msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

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
    kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    kindText: { fontSize: 13, fontWeight: '600', color: colors.teal },

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
    whenValue: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: 18, color: colors.teal, fontWeight: '700' },

    cancelButton: {
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#e53e3e',
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#e53e3e',
    },

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

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Hero: cochera, estado, tipo de reserva y conductor (vista propietario) */}
          <View style={styles.heroCard}>
            <View style={styles.titleRow}>
              <Text style={styles.spotTitle}>{booking.parkingSpotTitle}</Text>
              <StatusBadge status={booking.status} />
            </View>

            <View style={styles.kindRow}>
              <Ionicons name={booking.kind === 'STAY' ? 'calendar-outline' : 'time-outline'} size={14} color={colors.teal} />
              <Text style={styles.kindText}>
                {t(booking.kind === 'STAY' ? 'driver.booking.kind.stay' : 'driver.booking.kind.hourly')}
              </Text>
            </View>

            {isOwnerView && driverName && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.driver')}</Text>
                <Text style={styles.detailValue}>{driverName}</Text>
              </View>
            )}
          </View>

          <Pressable onPress={() => router.push(`${group}/bookings/${id}/messages`)}>
            <Card>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.messages.link')}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={13} color={colors.teal} />
              </View>
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push(`${group}/bookings/${id}/tickets`)}>
            <Card>
              <View style={styles.sectionHeader}>
                <Ionicons name="help-buoy-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.tickets.link')}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={13} color={colors.teal} />
              </View>
            </Card>
          </Pressable>

          {booking.status === 'CONFIRMED' && booking.verificationCode && (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>{t('driver.booking.codeLabel')}</Text>
              <Text style={styles.codeValue}>{booking.verificationCode}</Text>
              <Text style={styles.codeHint}>{t('driver.booking.codeHint')}</Text>
            </View>
          )}

          {/* Resumen: fecha, horario, duración y total */}
          <Card>
            <View style={styles.cardContent}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.summary')}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.whenValue}>{formatBookingWhen(booking, t('driver.booking.timeTo'))}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.duration')}</Text>
                <Text style={styles.detailValue}>{durationLabel(booking)}</Text>
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

        {/* Cancelar: sólo el conductor titular puede hacerlo (el backend lo exige) */}
        {!isOwnerView && (booking.status === 'CONFIRMED' || booking.status === 'PENDING_OWNER_APPROVAL') && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Pressable
              style={[styles.cancelButton, cancelling && { opacity: 0.5 }]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={styles.cancelButtonText}>
                {cancelling ? '...' : t('driver.booking.cancel.title')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
