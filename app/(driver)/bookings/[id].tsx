import { t, useLanguage } from '@/src/i18n';
import { bookingKindLabelKey, tracksExit } from '@/src/services/bookingKind';
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Modal, TouchableWithoutFeedback, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
import { VehicleSummaryRow } from '@/src/components/VehicleIdentity';
import { VerifyArrivalCode } from '@/src/components/VerifyArrivalCode';
import { BookingExit } from '@/src/components/booking/BookingExit';
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
import { PaymentDueCard } from '@/src/components/PaymentDue';
import { SpotSummaryRow } from '@/src/components/SpotSummaryCard';
import { useScale } from '@/src/theme/typography';
import { AccessInstructionsCard } from '@/src/components/booking/AccessInstructionsCard';
import { ExtendBooking } from '@/src/components/booking/ExtendBooking';
import { OwnerCancelBooking } from '@/src/components/booking/OwnerCancelBooking';
import { ReportButton } from '@/src/components/ReportButton';
import { shareReceipt } from '@/src/services/receipt';

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
    debtAmount: b.debt_amount ? b.debt_amount / 100 : undefined,
    ownerEarnings: ownerEarningsFrom(b),
    status: b.status as Booking['status'],
    paymentId: b.payment_id,
    paidAt: b.paid_at,
    cancellationReason: b.cancellation_reason,
    cancellationNote: b.cancellation_note,
    refundedAmount: (b.refunded_amount ?? 0) / 100,
    parentBookingId: b.parent_booking_id,
    extension: b.extension,
    verificationCode: b.verification_code,
    verifiedAt: b.verified_at,
    holdExpiresAt: b.hold_expires_at,
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

/** Días de check-in a check-out de una estadía. */
function stayDays(booking: Booking): number {
  return Math.max(1, Math.round(
    (new Date(`${booking.endDate}T00:00:00`).getTime() - new Date(`${booking.date}T00:00:00`).getTime()) / 86_400_000,
  ));
}

/** Duración legible: horas para HOURLY y HALF_DAY (12), días de check-in a check-out para STAY. */
function durationLabel(booking: Booking): string {
  if (booking.kind !== 'STAY') {
    return booking.hours === 1 ? t('driver.booking.durationOneHour') : t('driver.booking.durationHours', { hours: String(booking.hours) });
  }
  const days = stayDays(booking);
  return days === 1 ? t('driver.booking.durationOneDay') : t('driver.booking.durationDays', { days: String(days) });
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
  const largeText = scale > 1;
  const sc = (n: number) => Math.round(n * scale);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [spotLocation, setSpotLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  // The booked spot as it is now: its photo for the header, and whether it's still listed.
  const [spotInfo, setSpotInfo] = useState<
    { address: string; photoUrl: string | null; status: string; hourlyEnabled: boolean } | null
  >(null);
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
  const sessionUser = useSessionStore((s) => s.user);
  const [receiptBusy, setReceiptBusy] = useState(false);
  // Owner answering a PENDING_OWNER_APPROVAL request from here: which button is working.
  const [answering, setAnswering] = useState<'approve' | 'reject' | null>(null);
  // When the screen opened -- what "already started" / "in its last hour" is measured against.
  const [openedAt] = useState(() => Date.now());

  const load = useCallback(() => {
    if (!id) return;
    getBookingApi(id)
      .then(async (raw) => {
        // Even if its owner deleted it: the booking still has to say which spot it was.
        const spot = await getParkingSpotDetail(raw.parking_spot_id, { includeDeleted: true }).catch(() => null);
        setBooking(mapApiBooking(raw, spot?.title ?? raw.parking_spot_id, spot?.ownerId ?? ''));
        setSpotLocation(spot && spot.status !== 'deleted' ? { lat: spot.lat, lng: spot.lng, address: spot.address } : null);
        setSpotInfo(
          spot ? { address: spot.address, photoUrl: spot.photos?.[0] ?? null, status: spot.status, hourlyEnabled: spot.hourlyEnabled } : null,
        );
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

  // On every visit -- coming back from paying an extension shows where it stands.
  useFocusEffect(load);

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
      const partial = (updated.refunded_amount ?? 0) / 100;
      setCancelResult({
        ok: true,
        message: partial > 0
          ? t('driver.booking.cancel.successLate', { amount: formatPesos(partial) })
          : t('driver.booking.cancel.successMessage'),
      });
      load();
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
    spotNotice: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFFBEB',
    },
    spotNoticeText: { flex: 1, fontSize: sc(13), lineHeight: sc(18), color: '#92400E' },
    kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    kindText: { fontSize: sc(13), fontWeight: '600', color: colors.teal },

    cardContent: { gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },

    divider: { height: 1, backgroundColor: colors.border },
    // Same as the confirm screens: the value never squeezes the label -- it wraps on its own
    // side, and with the large text size it drops to its own line under the label.
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: largeText ? 'wrap' : 'nowrap', rowGap: 2 },
    detailLabel: { flexGrow: 1, flexShrink: 1, fontSize: sc(14), color: colors.textSecondary },
    detailHint: { fontSize: sc(12), color: colors.textSecondary, lineHeight: sc(17) },
    detailValue: largeText
      ? { flexBasis: '100%', paddingLeft: sc(16) + 8, fontSize: sc(14), color: colors.text, fontWeight: '600' }
      : { flexShrink: 1, textAlign: 'right', fontSize: sc(14), color: colors.text, fontWeight: '600' },
    // A name with its chevron: those rows don't wrap -- the name wraps within its side instead,
    // so the chevron never ends up alone on a line.
    detailRowLink: { flexWrap: 'nowrap' },
    detailValueLink: largeText ? { color: colors.teal, flexBasis: 'auto', paddingLeft: 0, flexShrink: 1, textAlign: 'right' } : { color: colors.teal },
    whenValue: { flex: 1, fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: sc(18), color: colors.teal, fontWeight: '700' },

    refundReason: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    refundBody: { flex: 1, fontSize: sc(14), color: colors.text, lineHeight: sc(20) },
    refundNote: { fontSize: sc(12), color: colors.textSecondary, lineHeight: sc(17) },
    reviewedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    reviewedText: { fontSize: sc(14), color: colors.textSecondary, fontWeight: '600' },
    answerRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
    answerBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 14, borderRadius: 12,
    },
    approveBtn: { backgroundColor: colors.teal },
    rejectBtn: { borderWidth: 1.5, borderColor: '#C62828' },
    approveBtnText: { color: colors.white, fontWeight: '700', fontSize: sc(15) },
    rejectBtnText: { color: '#C62828', fontWeight: '700', fontSize: sc(15) },
    // Outlined, secondary action ("Volver a reservar").
    receiptButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 12, borderWidth: 1.5, borderColor: colors.teal, paddingVertical: 13,
    },
    receiptButtonText: { fontSize: sc(15), fontWeight: '700', color: colors.teal },
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
    verifyTitle: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    verifyHint: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
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
  // The payment went through at some point (paymentId alone: paid before paidAt existed).
  const wasPaid = !!booking.paidAt || !!booking.paymentId;
  const isPaidAndConfirmed = booking.paidAt != null &&
    (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED');
  const paidDate = isPaidAndConfirmed && booking.paidAt ? new Date(booking.paidAt) : null;
  // Directions only help the driver, and only while they still have to get there -- the
  // owner knows where their own spot is.
  // The driver goes to the spot's public listing; its owner, to their own spot's page.
  const openSpot = () =>
    router.push(`${group}/${isOwnerView ? 'spots' : 'spot'}/${booking.parkingSpotId}` as never);
  // A booked spot that's no longer listed: paused (it may come back) or deleted for good.
  const spotNotice: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string } | null =
    spotInfo?.status === 'paused'
      ? { icon: 'pause-circle-outline', text: t(isOwnerView ? 'booking.spot.pausedOwner' : 'booking.spot.paused') }
      : spotInfo?.status === 'deleted'
        ? { icon: 'trash-outline', text: t(isOwnerView ? 'booking.spot.deletedOwner' : 'booking.spot.deleted') }
        : null;
  const showDirections = !isOwnerView && !!spotLocation &&
    (booking.status === 'PENDING_OWNER_APPROVAL' || booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS');

  const startMs = booking.startAt ? Date.parse(booking.startAt) : 0;
  const endMs = booking.endAt ? Date.parse(booking.endAt) : 0;
  const accepted = booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS';
  const notStarted = openedAt < startMs;
  // An extension is the same stay going on: no second arrival code.
  const isExtension = !!booking.parentBookingId;
  // The cancellation policy: in an accepted booking's last hour, half goes back.
  const lateCancellation = booking.status === 'CONFIRMED' && notStarted && openedAt > startMs - 60 * 60 * 1000;
  const canDriverCancel = !isOwnerView && notStarted &&
    (booking.status === 'CONFIRMED' || booking.status === 'PENDING_OWNER_APPROVAL');
  const canOwnerCancel = isOwnerView && notStarted && booking.status === 'CONFIRMED';
  // By the hour: an hourly booking always, a half-day when the spot also takes hourly bookings
  // (the extension is priced and checked as one -- see booking-service's ExtensionOptions).
  const extendableKind = booking.kind === 'HOURLY' || (booking.kind === 'HALF_DAY' && !!spotInfo?.hourlyEnabled);
  const canExtend = !isOwnerView && extendableKind && accepted && openedAt < endMs && !booking.extension;
  // What a cancelled booking gave back: part of it (refundedAmount), or all of it.
  // A full refund returns the whole payment: the booking's price and the pending balance it carried.
  const paidTotal = booking.total + (booking.debtAmount ?? 0);
  const refundTotal = booking.refundedAmount && booking.refundedAmount > 0 ? booking.refundedAmount : paidTotal;
  const sideParam = isOwnerView ? '?view=owner' : '';
  // Something went wrong with the stay (no-show, overstay, spot taken): from half an hour
  // before it starts, while it's on, and once it's over.
  // The driver's receipt: for any booking that was actually paid (a cancelled one shows what
  // went back).
  const canDownloadReceipt = !isOwnerView && !!booking.paidAt && booking.paymentId !== 'CASH';
  async function downloadReceipt() {
    if (!booking) return;
    setReceiptBusy(true);
    try {
      await shareReceipt({
        bookingId: booking.id,
        spotTitle: booking.parkingSpotTitle,
        spotAddress: spotInfo?.address,
        driverName: [sessionUser?.name, sessionUser?.lastName].filter(Boolean).join(' '),
        ownerName: ownerName ?? undefined,
        when: booking.kind !== 'HOURLY'
          ? `${formatLongDate(booking.date)}, ${booking.startTime} → ${formatLongDate(booking.endDate)}, ${booking.endTime}`
          : formatBookingWhen(booking, t('driver.booking.timeTo'), 'long'),
        duration: durationLabel(booking),
        vehicle: booking.vehicle
          ? [booking.vehicle.brand, booking.vehicle.model, booking.vehicle.plate].filter(Boolean).join(' · ')
          : undefined,
        total: paidTotal,
        paidAt: booking.paidAt ? formatLongDateTime(booking.paidAt) : undefined,
        paymentRef: booking.paymentId,
        status: t(`receipt.statusValue.${booking.status}`),
        refunded: booking.status === 'CANCELLED' ? refundTotal : booking.refundedAmount,
        issuedAt: formatLongDateTime(new Date().toISOString()),
      });
    } catch {
      alert(t('receipt.error'));
    } finally {
      setReceiptBusy(false);
    }
  }

  const receiptRow = canDownloadReceipt ? (
    <>
      <View style={styles.divider} />
      <Pressable style={styles.sectionHeader} onPress={downloadReceipt} disabled={receiptBusy}>
        <Ionicons name="document-text-outline" size={sc(15)} color={colors.teal} />
        <Text style={[styles.sectionLabel, { color: colors.teal }]}>{t('receipt.download')}</Text>
        <View style={{ flex: 1 }} />
        {receiptBusy ? <ActivityIndicator color={colors.teal} size="small" /> : <Ionicons name="download-outline" size={sc(15)} color={colors.teal} />}
      </Pressable>
    </>
  ) : null;

  // "Volver a reservar": a booking that's over (or never happened), on a spot still listed.
  const canRepeat = !isOwnerView && spotInfo?.status === 'active' &&
    (booking.status === 'COMPLETED' || booking.status === 'CANCELLED' || booking.status === 'EXPIRED');
  const repeatBooking = () => {
    const params = new URLSearchParams(
      booking.kind === 'STAY'
        ? { mode: 'stay', days: String(stayDays(booking)) }
        : booking.kind === 'HALF_DAY'
          ? { mode: 'halfDay' }
          : { mode: 'hourly', hours: String(booking.hours) },
    );
    if (booking.vehicle?.type) params.set('vehicleType', booking.vehicle.type);
    router.push(`${group}/spot/${booking.parkingSpotId}?${params.toString()}` as never);
  };
  const canReportProblem = (accepted || booking.status === 'COMPLETED') && openedAt > startMs - 30 * 60 * 1000;

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {!isOwnerView && booking.status === 'PENDING_PAYMENT' && (
            <PaymentDueCard
              bookingId={booking.id}
              holdExpiresAt={booking.holdExpiresAt}
              spotTitle={booking.parkingSpotTitle}
              when={formatBookingWhen(booking, t('driver.booking.timeTo'))}
            />
          )}
          {/* Hero: todo lo que responde "qué reservé, cuándo, cuánto salió" en una
              sola tarjeta -- antes el título y el Resumen vivían en tarjetas
              separadas con Mensajes/Ayuda metidos en el medio, cortando la lectura
              entre el nombre de la cochera y su propio resumen. */}
          <View style={styles.heroCard}>
            {/* The spot: tapping it opens its listing (the owner, their own spot's page) -- unless
                it was deleted. A spot that's no longer listed says so. */}
            <SpotSummaryRow
              title={booking.parkingSpotTitle}
              address={spotInfo?.address}
              photoUrl={spotInfo?.photoUrl}
              onPress={spotInfo && spotInfo.status !== 'deleted' ? openSpot : undefined}
            />
            {spotNotice && (
              <View style={styles.spotNotice}>
                <Ionicons name={spotNotice.icon} size={sc(16)} color={colors.warning} />
                <Text style={styles.spotNoticeText}>{spotNotice.text}</Text>
              </View>
            )}

            <View style={styles.kindRow}>
              <Ionicons
                name={booking.kind === 'STAY' ? 'calendar-outline' : booking.kind === 'HALF_DAY' ? 'hourglass-outline' : 'time-outline'}
                size={sc(14)}
                color={colors.teal}
              />
              <Text style={styles.kindText}>{t(bookingKindLabelKey(booking.kind))}</Text>
              <View style={{ flex: 1 }} />
              <StatusBadge status={booking.status} />
            </View>

            {isOwnerView && driverName && (
              <Pressable
                style={[styles.detailRow, styles.detailRowLink]}
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
                style={[styles.detailRow, styles.detailRowLink]}
                onPress={() => router.push(`${group}/profile/${booking.ownerId}?as=owner`)}
              >
                <Ionicons name="person-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.detail.owner')}</Text>
                <Text style={[styles.detailValue, styles.detailValueLink]}>{ownerName}</Text>
                <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
              </Pressable>
            )}

            {/* The driver's vehicle as one block: what it is, and its plate on the right. */}
            {booking.vehicle && (
              <>
                <View style={styles.divider} />
                <VehicleSummaryRow vehicle={booking.vehicle} />
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={sc(15)} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>{t('driver.booking.summary')}</Text>
            </View>

            {/* A stay (or a half-day, which can cross midnight) gets its check-in and check-out,
                each with its date and time -- here, in its detail, there's room for it (lists and
                notifications keep the short form). */}
            {booking.kind !== 'HOURLY' ? (
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
                <Text style={styles.whenValue}>{formatBookingWhen(booking, t('driver.booking.timeTo'), 'long')}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={sc(16)} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>{t('driver.booking.detail.duration')}</Text>
              <Text style={styles.detailValue}>{durationLabel(booking)}</Text>
            </View>
            {booking.extension && (
              <Pressable
                style={[styles.detailRow, styles.detailRowLink]}
                onPress={() => router.push(`${group}/bookings/${booking.extension!.id}${sideParam}` as never)}
              >
                <Ionicons name="add-circle-outline" size={sc(16)} color={colors.teal} />
                <Text style={styles.detailLabel}>
                  {booking.extension.status === 'PENDING_PAYMENT' ? t('booking.extend.awaitingPayment') : t('booking.extend.extendedUntil')}
                </Text>
                <Text style={[styles.detailValue, styles.detailValueLink]}>{booking.extension.end.slice(11, 16)}</Text>
                <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
              </Pressable>
            )}
            {isExtension && (
              <Pressable
                style={[styles.detailRow, styles.detailRowLink]}
                onPress={() => router.push(`${group}/bookings/${booking.parentBookingId}${sideParam}` as never)}
              >
                <Ionicons name="return-up-back-outline" size={sc(16)} color={colors.teal} />
                <Text style={styles.detailLabel}>{t('booking.extend.isExtension')}</Text>
                <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
              </Pressable>
            )}

            <View style={styles.divider} />

            {/* The driver sees what they were charged. The owner sees what they earn --
                their own price, without ParkLink's commission -- and, below, what the
                driver paid. */}
            {/* Carrying the driver's pending balance (extra time on earlier bookings): the payment is
                the booking's price plus that, itemised -- the owner never sees it. */}
            {!isOwnerView && !!booking.debtAmount && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('booking.debt.price')}</Text>
                  <Text style={styles.detailValue}>{formatPesos(booking.total)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('booking.debt.included')}</Text>
                  <Text style={styles.detailValue}>{formatPesos(booking.debtAmount)}</Text>
                </View>
                <Text style={styles.detailHint}>{t('booking.debt.includedHint')}</Text>
              </>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t(isOwnerView ? 'owner.booking.youEarnLabel' : 'driver.booking.total')}</Text>
              <Text style={styles.totalValue}>
                {formatPesos(isOwnerView ? booking.ownerEarnings ?? booking.total : paidTotal)}
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
          {isOwnerView && booking.status === 'CONFIRMED' && !isExtension && booking.startAt && booking.endAt && (
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

          {/* How a verified hourly booking ends: the driver's exit code (and the owner's button to enter
              it) while it waits, then when the vehicle left and what staying past the end came to.
              A booking carried on by a paid extension ends there instead. */}
          {/* (booking-service only sends verified_at to the driver, so the owner just asks: an exit
              that doesn't apply comes back as nothing to show.) */}
          {tracksExit(booking.kind) &&
            (isOwnerView || booking.verifiedAt) &&
            ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status) &&
            booking.endAt &&
            !(booking.extension && booking.extension.status !== 'PENDING_PAYMENT') && (
              <BookingExit
                bookingId={booking.id}
                role={isOwnerView ? 'owner' : 'driver'}
                endAt={booking.endAt}
                onChanged={load}
              />
            )}

          {!isOwnerView && accepted && <AccessInstructionsCard bookingId={booking.id} />}

          {isRefundable && (
            <Card>
              <View style={styles.cardContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="return-down-back-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.sectionLabel}>{t('booking.refund.section')}</Text>
                </View>
                {/* The reasons are written to the driver ("Cancelaste...") -- the owner gets the
                    explanation below instead. */}
                {booking.cancellationReason && !(isOwnerView && booking.cancellationReason.startsWith('DRIVER_')) && (
                  <Text style={styles.refundReason}>
                    {t(`booking.refund.reason.${booking.cancellationReason}`)}
                  </Text>
                )}
                {booking.cancellationNote ? (
                  <Text style={styles.refundBody}>{t('booking.refund.ownerNote', { note: booking.cancellationNote })}</Text>
                ) : null}
                {isOwnerView ? (
                  <Text style={styles.refundBody}>
                    {t(booking.cancellationReason === 'DRIVER_LATE_CANCELLED' ? 'booking.refund.ownerBodyLate' : 'booking.refund.ownerBody')}
                  </Text>
                ) : (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons
                        name={refund?.status === 'refunded' ? 'checkmark-circle' : 'time-outline'}
                        size={18}
                        color={refund?.status === 'refunded' ? colors.teal : colors.warning}
                      />
                      <Text style={styles.refundBody}>
                        {refund?.status === 'refunded'
                          ? t('booking.refund.done', {
                              amount: formatPesos(refund.amount ?? refundTotal),
                              date: refund.refundedAt ? formatLongDateFromISO(refund.refundedAt) : '',
                            })
                          : refund?.status === 'delayed'
                            ? t('booking.refund.delayed', { amount: formatPesos(refund.amount ?? refundTotal) })
                            : refund?.status === 'in_progress'
                            ? t('booking.refund.inProgress', { amount: formatPesos(refund.amount ?? refundTotal) })
                            : t('booking.refund.automatic', { amount: formatPesos(refundTotal) })}
                      </Text>
                    </View>
                    <Text style={styles.refundNote}>{t('booking.refund.timingNote')}</Text>
                    {receiptRow}
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
                {receiptRow}
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

              {/* Messages open up once the booking is paid -- booking-service refuses them
                  before (BOOKING_NOT_PAID). */}
              {wasPaid && (
                <>
                  <Pressable style={styles.sectionHeader} onPress={() => router.push(`${group}/bookings/${id}/messages`)}>
                    <Ionicons name="chatbubble-outline" size={sc(15)} color={colors.textSecondary} />
                    <Text style={styles.sectionLabel}>{t('driver.booking.messages.link')}</Text>
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={sc(13)} color={colors.teal} />
                  </Pressable>

                  <View style={styles.divider} />
                </>
              )}

              <Pressable style={styles.sectionHeader} onPress={() => router.push(`${group}/bookings/${id}/tickets`)}>
                <Ionicons name="help-buoy-outline" size={sc(15)} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.tickets.link')}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={sc(13)} color={colors.teal} />
              </Pressable>
            </View>
          </Card>

          {canReportProblem && (
            <View style={{ alignItems: 'center' }}>
              <ReportButton targetType="booking" targetId={booking.id} bookingSide={isOwnerView ? 'owner' : 'driver'} />
            </View>
          )}
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
                <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
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

        {canRepeat && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Pressable style={styles.receiptButton} onPress={repeatBooking}>
              <Ionicons name="refresh" size={sc(18)} color={colors.teal} />
              <Text style={styles.receiptButtonText}>{t('booking.repeat')}</Text>
            </Pressable>
          </View>
        )}

        {/* Extender: el conductor suma horas a una reserva por hora aceptada, mientras siga
            libre; paga sólo esa parte en la extensión. */}
        {canExtend && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <ExtendBooking
              bookingId={booking.id}
              onExtended={(extensionId) => router.push(`${group}/bookings/${extensionId}` as never)}
            />
          </View>
        )}

        {/* El propietario puede cancelar una reserva que ya aceptó, antes de que empiece y
            diciendo por qué -- el conductor recibe todo de vuelta. */}
        {canOwnerCancel && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <OwnerCancelBooking bookingId={booking.id} onCancelled={load} />
          </View>
        )}

        {/* Cancelar: sólo el conductor titular puede hacerlo (el backend lo exige), y antes de
            que empiece. */}
        {canDriverCancel && (
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
                <Text style={styles.modalBody}>
                  {lateCancellation
                    ? t('driver.booking.cancel.confirmLate', { amount: formatPesos(booking.total / 2) })
                    : t('driver.booking.cancel.confirm')}
                </Text>
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
