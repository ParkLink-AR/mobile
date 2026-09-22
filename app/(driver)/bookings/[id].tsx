import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
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
import { mapBookingDateRange, formatBookingWhen, formatFullDate } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';

/** Maps the backend wire shape to the UI Booking type -- same mapping as the
 * driver's booking list (see (tabs)/bookings.tsx), plus payment_id/updated_at
 * which the list doesn't need but the detail view does. */
function mapApiBooking(b: BookingApiResponse, spotTitle: string, ownerId: string): Booking {
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0;

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: spotTitle,
    driverId: b.user_id,
    driverName: '',
    ownerId,
    kind: b.kind,
    ...mapBookingDateRange(b.start, b.end),
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    status: b.status as Booking['status'],
    paymentId: b.payment_id,
    paidAt: b.paid_at,
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
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBookingApi(id)
      .then(async (raw) => {
        const spot = await getParkingSpotDetail(raw.parking_spot_id).catch(() => null);
        setBooking(mapApiBooking(raw, spot?.title ?? raw.parking_spot_id, spot?.ownerId ?? ''));
        if (isOwnerView) {
          getPublicProfileApi(raw.user_id)
            .then((profile) => setDriverName(profile.name))
            .catch(() => {});
        } else if (spot?.ownerId) {
          getPublicProfileApi(spot.ownerId)
            .then((profile) => setOwnerName(profile.name))
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[BookingDetail] fetch error:', err);
        setError(true);
      });
  }, [id, isOwnerView]);

  // Alert.alert with a buttons array is a no-op on web (react-native-web's Alert module
  // has no UI at all) -- a real Modal (below, in the JSX) works on every platform, same
  // pattern spots/[id]/edit.tsx and profile.tsx already use for their own confirmations.
  function handleCancel() {
    if (!booking) return;
    setConfirmCancelVisible(true);
  }

  async function performCancel() {
    if (!booking) return;
    setConfirmCancelVisible(false);
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
    detailValueLink: { color: colors.teal },
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

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalSheet: {
      width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      backgroundColor: colors.surface, alignItems: 'center', gap: 8,
    },
    modalTitle: {
      fontSize: 16, fontWeight: '700', color: colors.text,
      marginBottom: 8, textAlign: 'center',
    },
    modalBody: {
      fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18,
      marginBottom: 8,
    },
    modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
    modalCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
    modalConfirmBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      backgroundColor: '#e53e3e',
    },
    modalConfirmBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
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

  // A booking's payment_id/paid_at are set once, the moment Mercado Pago's payment was
  // confirmed, and never cleared afterward -- even if the owner later rejects it, it
  // expires, or it's cancelled. So neither field alone means "this booking is currently
  // paid" -- only true once the booking is actually confirmed and stays that way
  // (CONFIRMED/IN_PROGRESS/COMPLETED), never for PENDING_OWNER_APPROVAL, EXPIRED, or
  // CANCELLED, regardless of whether the money moved at some point.
  const isPaidAndConfirmed = booking.paidAt != null &&
    (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED');
  const paidDate = isPaidAndConfirmed && booking.paidAt ? new Date(booking.paidAt) : null;

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
              <Pressable
                style={styles.detailRow}
                onPress={() => router.push(`${group}/profile/${booking.driverId}?as=driver`)}
              >
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.driver')}</Text>
                <Text style={[styles.detailValue, styles.detailValueLink]}>{driverName}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.teal} />
              </Pressable>
            )}

            {!isOwnerView && ownerName && (
              <Pressable
                style={styles.detailRow}
                onPress={() => router.push(`${group}/profile/${booking.ownerId}?as=owner`)}
              >
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.owner')}</Text>
                <Text style={[styles.detailValue, styles.detailValueLink]}>{ownerName}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.teal} />
              </Pressable>
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

              {booking.kind === 'STAY' ? (
                <>
                  <View style={styles.detailRow}>
                    <Ionicons name="log-in-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('spot.stay.checkIn')}</Text>
                    <Text style={styles.detailValue}>{formatFullDate(booking.date)} · {booking.startTime}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('spot.stay.checkOut')}</Text>
                    <Text style={styles.detailValue}>{formatFullDate(booking.endDate)} · {booking.endTime}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.whenValue}>{formatBookingWhen(booking, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'))}</Text>
                </View>
              )}
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

          {/* Pago: solo si el pago realmente se confirmó y la reserva sigue confirmada --
              payment_id/paid_at quedan grabados aunque después se rechace, expire o
              cancele, así que mostrarlos siempre haría ver como "pagado" algo que no lo
              está (ver isPaidAndConfirmed más arriba). */}
          {isPaidAndConfirmed && (
            <Card>
              <View style={styles.cardContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="card-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.sectionLabel}>{t('driver.booking.detail.paymentSection')}</Text>
                </View>

                {paidDate && (
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('driver.booking.detail.paidAt')}</Text>
                    <Text style={styles.detailValue}>
                      {paidDate.toLocaleDateString('es-AR')} · {paidDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
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

      <Modal
        visible={confirmCancelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmCancelVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setConfirmCancelVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('driver.booking.cancel.title')}</Text>
                <Text style={styles.modalBody}>{t('driver.booking.cancel.confirm')}</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [styles.modalCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => setConfirmCancelVisible(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.modalConfirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                    onPress={performCancel}
                  >
                    <Text style={styles.modalConfirmBtnText}>{t('driver.booking.cancel.yes')}</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}
