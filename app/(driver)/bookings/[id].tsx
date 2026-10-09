import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Modal, TouchableWithoutFeedback, Linking } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
import { VehiclePlate } from '@/src/components/VehiclePlate';
import { vehicleDescription } from '@/src/components/VehicleIdentity';
import { VerifyArrivalCode } from '@/src/components/VerifyArrivalCode';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import {
  getBookingApi,
  cancelBookingApi,
  getBookingReviewsApi,
  getRefundStatusApi,
  approveBookingApi,
  rejectBookingApi,
  BookingApiResponse,
  RefundStatusResponse,
  ReviewTargetType,
} from '@/src/api/booking';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';
import { ApiError } from '@/src/api/client';
import { getParkingSpotDetail } from '@/src/api/parking';
import { getPublicProfileApi } from '@/src/api/auth';
import { mapBookingDateRange, formatBookingWhen, formatLongDate, formatLongDateFromISO, formatLongDateTime, toVehicleSnapshot, ownerEarningsFrom } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';
import { useScale } from '@/src/theme/typography';

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
    ownerEarnings: ownerEarningsFrom(b),
    status: b.status as Booking['status'],
    paymentId: b.payment_id,
    paidAt: b.paid_at,
    cancellationReason: b.cancellation_reason,
    verificationCode: b.verification_code,
    vehicle: toVehicleSnapshot(b.vehicle),
  };
}

function formatPesos(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Opens the phone's own map app in turn-by-turn directions mode. Google's universal
 * "dir" URL (not the `maps://`/`geo:` custom schemes) is used on purpose: it works via a
 * plain `Linking.openURL` on every platform with no extra native config -- `maps://`
 * specifically needs the scheme declared in iOS's LSApplicationQueriesSchemes to even be
 * openable, which this app doesn't do. If Google Maps is installed this deep-links
 * straight into it; otherwise it falls back to opening in the browser. */
function openDirections(lat: number, lng: number) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
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
  const segment = useSegments()[0];
  const group = `/${segment}`;
  // `view` says which side of the booking to show when it's opened from somewhere that
  // isn't tied to one side (a notification, a push) -- those always navigate within the
  // current route group so the back button keeps working, and pass the side explicitly.
  // Without it, the route group decides: the owner screens open the owner's view.
  const { id, view } = useLocalSearchParams<{ id: string; view?: 'owner' | 'driver' }>();
  const isOwnerView = view ? view === 'owner' : segment === '(owner)';
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [spotLocation, setSpotLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ ok: boolean; message: string } | null>(null);
  const userId = useSessionStore((s) => s.user?.id);
  // Whether the viewer still owes this (COMPLETED) booking a rating -- null until known.
  // Each side rates once and for good: the owner rates the driver, the driver rates the
  // spot and its owner (booking-service rejects a second review of the same target).
  const [reviewPending, setReviewPending] = useState<boolean | null>(null);
  const [refund, setRefund] = useState<RefundStatusResponse | null>(null);
  // Owner answering a PENDING_OWNER_APPROVAL request from here: which button is working.
  const [answering, setAnswering] = useState<'approve' | 'reject' | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getBookingApi(id)
      .then(async (raw) => {
        const spot = await getParkingSpotDetail(raw.parking_spot_id).catch(() => null);
        setBooking(mapApiBooking(raw, spot?.title ?? raw.parking_spot_id, spot?.ownerId ?? ''));
        setSpotLocation(spot ? { lat: spot.lat, lng: spot.lng, address: spot.address } : null);
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

  useEffect(load, [load]);

  const isCompleted = booking?.status === 'COMPLETED';
  // A cancelled booking that had been paid (and not in cash) gets its money back --
  // show the driver where that stands.
  const isRefundable = booking?.status === 'CANCELLED' && !!booking.paidAt && booking.paymentId !== 'CASH';
  useFocusEffect(
    useCallback(() => {
      if (!id || !isRefundable || isOwnerView) return;
      getRefundStatusApi(id).then(setRefund).catch(() => setRefund(null));
    }, [id, isRefundable, isOwnerView]),
  );
  // Re-checked on focus, so coming back from the review screen hides the button at once.
  useFocusEffect(
    useCallback(() => {
      if (!id || !userId || !isCompleted) return;
      const required: ReviewTargetType[] = isOwnerView ? ['driver'] : ['spot', 'owner'];
      getBookingReviewsApi(id)
        .then((reviews) => {
          const mine = new Set(reviews.filter((r) => r.reviewer_id === userId).map((r) => r.target_type));
          setReviewPending(required.some((target) => !mine.has(target)));
        })
        .catch(() => setReviewPending(null));
    }, [id, userId, isCompleted, isOwnerView]),
  );

  // Alert.alert with a buttons array is a no-op on web (react-native-web's Alert module
  // has no UI at all) -- a real Modal (below, in the JSX) works on every platform, same
  // pattern spots/[id]/edit.tsx and profile.tsx already use for their own confirmations.
  function handleCancel() {
    if (!booking) return;
    setConfirmCancelVisible(true);
  }

  async function answerRequest(approve: boolean) {
    if (!booking) return;
    setAnswering(approve ? 'approve' : 'reject');
    try {
      await (approve ? approveBookingApi(booking.id) : rejectBookingApi(booking.id));
      load();
      // The request's accept/reject buttons in the notifications tab go away right away.
      useNotificationsStore.getState().markAnswered(booking.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t(approve ? 'owner.spot.requests.errorApprove' : 'owner.spot.requests.errorReject'));
    } finally {
      setAnswering(null);
    }
  }

  async function performCancel() {
    if (!booking) return;
    setConfirmCancelVisible(false);
    setCancelling(true);
    try {
      const updated = await cancelBookingApi(booking.id);
      setBooking((prev) => prev ? { ...prev, status: updated.status as Booking['status'] } : prev);
      setCancelResult({ ok: true, message: t('driver.booking.cancel.successMessage') });
    } catch (err: any) {
      const msg = err?.detail ?? err?.message ?? t('driver.booking.detail.error');
      setCancelResult({ ok: false, message: msg });
    } finally {
      setCancelling(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },

    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    spotTitle: { flex: 1, fontSize: sc(19), fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
    kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    kindText: { fontSize: sc(13), fontWeight: '600', color: colors.teal },

    cardContent: { gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },

    divider: { height: 1, backgroundColor: colors.border },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { flex: 1, fontSize: sc(14), color: colors.textSecondary },
    detailValue: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    detailValueLink: { color: colors.teal },
    whenValue: { flex: 1, fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: sc(18), color: colors.teal, fontWeight: '700' },

    refundReason: { fontSize: 14, color: colors.text, fontWeight: '600' },
    refundBody: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    refundNote: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    reviewedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    reviewedText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
    answerRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
    answerBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 14, borderRadius: 12,
    },
    approveBtn: { backgroundColor: colors.teal },
    rejectBtn: { borderWidth: 1.5, borderColor: '#C62828' },
    approveBtnText: { color: colors.white, fontWeight: '700', fontSize: sc(15) },
    rejectBtnText: { color: '#C62828', fontWeight: '700', fontSize: sc(15) },
    cancelButton: {
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#e53e3e',
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: sc(15),
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
    codeLabel: { fontSize: sc(12), color: colors.textSecondary },
    codeValue: { fontSize: sc(32), fontWeight: '700', color: colors.teal, letterSpacing: 6 },
    codeHint: { fontSize: sc(12), color: colors.textSecondary, textAlign: 'center' },

    verifyCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.teal,
      borderRadius: 14,
      padding: 16,
      gap: 10,
    },
    verifyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    verifyHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    inProgressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.teal,
      borderRadius: 14,
      padding: 16,
    },
    inProgressText: { flex: 1, gap: 2 },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalSheet: {
      width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      backgroundColor: colors.surface, alignItems: 'center', gap: 8,
    },
    modalTitle: {
      fontSize: sc(16), fontWeight: '700', color: colors.text,
      marginBottom: 8, textAlign: 'center',
    },
    modalBody: {
      fontSize: sc(13), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(18),
      marginBottom: 8,
    },
    modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
    modalCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    modalConfirmBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      backgroundColor: '#e53e3e',
    },
    modalConfirmBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
    modalAckBtn: {
      width: '100%', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      marginTop: 8,
    },
    modalAckBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
  });

  if (error) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={sc(40)} color={colors.textSecondary} />
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
  // Directions only help the driver, and only while they still have to get there -- the
  // owner knows where their own spot is.
  const showDirections = !isOwnerView && !!spotLocation &&
    (booking.status === 'PENDING_OWNER_APPROVAL' || booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS');

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Hero: todo lo que responde "qué reservé, cuándo, cuánto salió" en una
              sola tarjeta -- antes el título y el Resumen vivían en tarjetas
              separadas con Mensajes/Ayuda metidos en el medio, cortando la lectura
              entre el nombre de la cochera y su propio resumen. */}
          <View style={styles.heroCard}>
            <View style={styles.titleRow}>
              <Text style={styles.spotTitle}>{booking.parkingSpotTitle}</Text>
              <StatusBadge status={booking.status} />
            </View>

            <View style={styles.kindRow}>
              <Ionicons name={booking.kind === 'STAY' ? 'calendar-outline' : 'time-outline'} size={sc(14)} color={colors.teal} />
              <Text style={styles.kindText}>
                {t(booking.kind === 'STAY' ? 'driver.booking.kind.stay' : 'driver.booking.kind.hourly')}
              </Text>
            </View>

            {isOwnerView && driverName && (
              <Pressable
                style={styles.detailRow}
                onPress={() => router.push(`${group}/profile/${booking.driverId}?as=driver`)}
              >
                <Ionicons name="person-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.driver')}</Text>
                <Text style={[styles.detailValue, styles.detailValueLink]}>{driverName}</Text>
                <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
              </Pressable>
            )}

            {!isOwnerView && ownerName && (
              <Pressable
                style={styles.detailRow}
                onPress={() => router.push(`${group}/profile/${booking.ownerId}?as=owner`)}
              >
                <Ionicons name="person-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.owner')}</Text>
                <Text style={[styles.detailValue, styles.detailValueLink]}>{ownerName}</Text>
                <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
              </Pressable>
            )}

            {booking.vehicle && (
              <>
                <View style={styles.detailRow}>
                  <Ionicons name="car-outline" size={sc(16)} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('driver.booking.detail.vehicle')}</Text>
                  <Text style={styles.detailValue}>{vehicleDescription(booking.vehicle)}</Text>
                </View>
                {/* A bicycle has no plate. */}
                {booking.vehicle.plate ? (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="card-text-outline" size={sc(16)} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('driver.booking.detail.plate')}</Text>
                    <VehiclePlate plate={booking.vehicle.plate} size="small" align="end" />
                  </View>
                ) : null}
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={sc(15)} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>{t('driver.booking.summary')}</Text>
            </View>

            {booking.kind === 'STAY' ? (
              <>
                <View style={styles.detailRow}>
                  <Ionicons name="log-in-outline" size={sc(16)} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('spot.stay.checkIn')}</Text>
                  <Text style={styles.detailValue}>{formatLongDate(booking.date)}, {booking.startTime}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="log-out-outline" size={sc(16)} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('spot.stay.checkOut')}</Text>
                  <Text style={styles.detailValue}>{formatLongDate(booking.endDate)}, {booking.endTime}</Text>
                </View>
              </>
            ) : (
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.whenValue}>{formatBookingWhen(booking, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'), 'long')}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={sc(16)} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>{t('driver.booking.detail.duration')}</Text>
              <Text style={styles.detailValue}>{durationLabel(booking)}</Text>
            </View>

            <View style={styles.divider} />

            {/* The driver sees what they were charged. The owner sees what they earn --
                their own price, without ParkLink's commission -- and, below, what the
                driver paid. */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t(isOwnerView ? 'owner.booking.youEarnLabel' : 'driver.booking.total')}</Text>
              <Text style={styles.totalValue}>
                {formatPesos(isOwnerView ? booking.ownerEarnings ?? booking.total : booking.total)}
              </Text>
            </View>
            {isOwnerView && booking.ownerEarnings !== undefined && booking.ownerEarnings !== booking.total && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('owner.booking.driverPaid')}</Text>
                <Text style={styles.detailValue}>{formatPesos(booking.total)}</Text>
              </View>
            )}
          </View>

          {/* The driver's arrival code: they tell it to the owner, who types it in below. */}
          {!isOwnerView && booking.status === 'CONFIRMED' && booking.verificationCode && (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>{t('driver.booking.codeLabel')}</Text>
              <Text style={styles.codeValue}>{booking.verificationCode}</Text>
              <Text style={styles.codeHint}>{t('driver.booking.codeHint')}</Text>
            </View>
          )}

          {/* Propietario: acá carga el código que el conductor le dice al llegar -- es la
              pantalla a la que llega desde Hoy, el Calendario y las notificaciones. Al
              verificarlo la reserva pasa a EN CURSO. */}
          {isOwnerView && booking.status === 'CONFIRMED' && booking.startAt && booking.endAt && (
            <View style={styles.verifyCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="key-outline" size={15} color={colors.teal} />
                <Text style={styles.verifyTitle}>{t('owner.verify.cardTitle')}</Text>
              </View>
              <Text style={styles.verifyHint}>{t('owner.verify.cardHint')}</Text>
              <VerifyArrivalCode
                bookingId={booking.id}
                startAt={booking.startAt}
                endAt={booking.endAt}
                onVerified={load}
              />
            </View>
          )}

          {booking.status === 'IN_PROGRESS' && (
            <View style={styles.inProgressCard}>
              <Ionicons name="shield-checkmark" size={28} color={colors.teal} />
              <View style={styles.inProgressText}>
                <Text style={styles.verifyTitle}>{t('booking.inProgress.title')}</Text>
                <Text style={styles.verifyHint}>{t('booking.inProgress.body')}</Text>
              </View>
            </View>
          )}

          {isRefundable && (
            <Card>
              <View style={styles.cardContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="return-down-back-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.sectionLabel}>{t('booking.refund.section')}</Text>
                </View>
                {booking.cancellationReason && (
                  <Text style={styles.refundReason}>
                    {t(`booking.refund.reason.${booking.cancellationReason}`)}
                  </Text>
                )}
                {isOwnerView ? (
                  <Text style={styles.refundBody}>{t('booking.refund.ownerBody')}</Text>
                ) : (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons
                        name={refund?.status === 'refunded' ? 'checkmark-circle' : 'time-outline'}
                        size={18}
                        color={refund?.status === 'refunded' ? colors.success : colors.warning}
                      />
                      <Text style={styles.refundBody}>
                        {refund?.status === 'refunded'
                          ? t('booking.refund.done', {
                              amount: formatPesos(refund.amount ?? booking.total),
                              date: refund.refundedAt ? formatLongDateFromISO(refund.refundedAt) : '',
                            })
                          : refund?.status === 'delayed'
                            ? t('booking.refund.delayed', { amount: formatPesos(refund.amount ?? booking.total) })
                            : refund?.status === 'in_progress'
                            ? t('booking.refund.inProgress', { amount: formatPesos(refund.amount ?? booking.total) })
                            : t('booking.refund.automatic', { amount: formatPesos(booking.total) })}
                      </Text>
                    </View>
                    <Text style={styles.refundNote}>{t('booking.refund.timingNote')}</Text>
                  </>
                )}
              </View>
            </Card>
          )}

          {/* Pago: solo si el pago realmente se confirmó y la reserva sigue confirmada --
              payment_id/paid_at quedan grabados aunque después se rechace, expire o
              cancele, así que mostrarlos siempre haría ver como "pagado" algo que no lo
              está (ver isPaidAndConfirmed más arriba). Es el dato menos urgente de la
              pantalla -- un comprobante, no la razón por la que alguien entra acá -- así
              que queda después del resumen y el código, no compitiendo con ellos. Es el
              comprobante del conductor: el propietario ya ve lo que gana en el resumen. */}
          {!isOwnerView && isPaidAndConfirmed && (
            <Card>
              <View style={styles.cardContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="card-outline" size={sc(15)} color={colors.textSecondary} />
                  <Text style={styles.sectionLabel}>{t('driver.booking.detail.paymentSection')}</Text>
                </View>

                {paidDate && (
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle-outline" size={sc(16)} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('driver.booking.detail.paidAt')}</Text>
                    <Text style={styles.detailValue}>
                      {formatLongDateTime(paidDate.toISOString())}
                    </Text>
                  </View>
                )}
                {booking.paymentId && (
                  <View style={styles.detailRow}>
                    <Ionicons name="receipt-outline" size={sc(16)} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('driver.booking.detail.paymentRef')}</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>{booking.paymentId}</Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Comunicación: Mensajes y Ayuda son la misma clase de cosa -- dos formas
              de hacer algo sobre esta reserva, no dos secciones de información -- así
              que comparten una tarjeta con dos filas, mismo patrón que Preferencias
              en el perfil. Va al final, después de los datos de la reserva. */}
          <Card>
            <View style={styles.cardContent}>
              {showDirections && spotLocation && (
                <>
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() => openDirections(spotLocation.lat, spotLocation.lng)}
                  >
                    <Ionicons name="navigate-outline" size={sc(15)} color={colors.textSecondary} />
                    <Text style={styles.sectionLabel}>{t('driver.booking.detail.directions')}</Text>
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={sc(13)} color={colors.teal} />
                  </Pressable>

                  <View style={styles.divider} />
                </>
              )}

              <Pressable style={styles.sectionHeader} onPress={() => router.push(`${group}/bookings/${id}/messages`)}>
                <Ionicons name="chatbubble-outline" size={sc(15)} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.messages.link')}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={sc(13)} color={colors.teal} />
              </Pressable>

              <View style={styles.divider} />

              <Pressable style={styles.sectionHeader} onPress={() => router.push(`${group}/bookings/${id}/tickets`)}>
                <Ionicons name="help-buoy-outline" size={sc(15)} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.tickets.link')}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={sc(13)} color={colors.teal} />
              </Pressable>
            </View>
          </Card>
        </View>

        {/* Calificar: una vez terminada la reserva (COMPLETED, apenas pasa su horario de
            fin), cada lado califica una sola vez -- después queda la confirmación. */}
        {isCompleted && reviewPending !== null && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            {reviewPending ? (
              <Button
                title={t(isOwnerView ? 'booking.review.rateDriver' : 'booking.review.rateOwner')}
                onPress={() => router.push(`${group}/review/${booking.id}?role=${isOwnerView ? 'owner' : 'driver'}`)}
              />
            ) : (
              <View style={styles.reviewedRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.reviewedText}>{t('booking.review.done')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Solicitud a confirmar: el propietario la aprueba o rechaza desde acá mismo. */}
        {isOwnerView && booking.status === 'PENDING_OWNER_APPROVAL' && (
          <View style={styles.answerRow}>
            <Pressable
              style={[styles.answerBtn, styles.rejectBtn]}
              onPress={() => answerRequest(false)}
              disabled={answering !== null}
            >
              {answering === 'reject' ? (
                <ActivityIndicator color="#C62828" size="small" />
              ) : (
                <>
                  <Ionicons name="close" size={sc(18)} color="#C62828" />
                  <Text style={styles.rejectBtnText}>{t('owner.spot.requests.reject')}</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.answerBtn, styles.approveBtn]}
              onPress={() => answerRequest(true)}
              disabled={answering !== null}
            >
              {answering === 'approve' ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={sc(18)} color={colors.white} />
                  <Text style={styles.approveBtnText}>{t('owner.spot.requests.approve')}</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

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

      <Modal
        visible={!!cancelResult}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelResult(null)}
      >
        <TouchableWithoutFeedback onPress={() => setCancelResult(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Ionicons
                  name={cancelResult?.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={sc(44)}
                  color={cancelResult?.ok ? colors.teal : '#e53e3e'}
                />
                <Text style={styles.modalTitle}>
                  {cancelResult?.ok ? t('driver.booking.cancel.successTitle') : t('driver.booking.cancel.errorTitle')}
                </Text>
                <Text style={styles.modalBody}>{cancelResult?.message}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalAckBtn,
                    { backgroundColor: cancelResult?.ok ? colors.teal : '#e53e3e', opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setCancelResult(null)}
                >
                  <Text style={styles.modalAckBtnText}>{t('driver.booking.cancel.ack')}</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}
