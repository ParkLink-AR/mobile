import { t, useLanguage } from '@/src/i18n';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Pressable } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { MercadoPagoLogo } from '@/src/components/MercadoPagoLogo';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { request } from '@/src/api/client';
import { BookingApiResponse, getBookingApi } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { usePaymentApprovedSound } from '@/src/services/paymentSound';
import { formatBookingWhen, formatLongDateFromISO, formatShortDate, formatTime, mapBookingDateRange } from '@/src/services/bookingDates';

// 'refunded': Mercado Pago approved the payment, but the booking couldn't take it (its
// hold ran out first) -- payment-service refunds it automatically.
type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'unknown';

// Statuses a booking can only reach once its payment was actually accepted.
const PAID_BOOKING_STATUSES = new Set(['PENDING_OWNER_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']);

interface VerifyStatusResponse {
  currentStatus: string;
  transaction?: { approved_at?: string | null } | null;
}

// Poll every 2 seconds, up to 2 minutes (60 attempts).
// Uses POST /payments/verify-status which queries MercadoPago directly if the
// transaction isn't in our DB yet — works even when the webhook hasn't arrived
// (e.g. WEBHOOK_BASE_URL is localhost and MP can't reach it in dev).
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60; // 2 minutes max

const SUCCESS = '#16A34A';
const WARNING = '#D97706';
const DANGER = '#DC2626';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type StepState = 'done' | 'current' | 'upcoming';

function formatPaidAt(iso: string): string {
  return t('driver.payment.result.paidOn', { date: formatLongDateFromISO(iso), time: formatTime(iso) });
}

// "9 de octubre de 2026, 10:00 a 13:00"; a multi-day stay, compact so it fits on one line:
// "08/10/2026 15:00 – 10/10/2026 12:00".
function formatWhen(booking: BookingApiResponse): string {
  const range = mapBookingDateRange(booking.start, booking.end);
  if (range.date && range.date !== range.endDate) {
    return `${formatShortDate(range.date)} ${range.startTime} – ${formatShortDate(range.endDate)} ${range.endTime}`;
  }
  return formatBookingWhen(range, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'), 'long');
}

function formatPesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Where Mercado Pago sends the driver back after paying. It doesn't trust that redirect:
 * it asks the backend (which asks Mercado Pago) until the payment is settled, and then
 * shows how it went -- reserved, paid but waiting for the owner, rejected, paid too late
 * (refunded), or still unconfirmed -- with the booking's receipt when it went through.
 */
export default function PaymentPendingScreen() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [status, setStatus] = useState<PaymentStatus>('pending');
  // Paid, but the spot's owner still has to accept the booking.
  const [awaitingOwner, setAwaitingOwner] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingApiResponse | null>(null);
  const [spotTitle, setSpotTitle] = useState<string | null>(null);
  const pollCount = useRef(0);
  // Loaded with the screen so it plays the instant the payment is approved; through a ref
  // because the polling effect below only restarts for a new booking.
  const playApproved = usePaymentApprovedSound();
  const playApprovedRef = useRef(playApproved);
  useEffect(() => {
    playApprovedRef.current = playApproved;
  }, [playApproved]);

  // The receipt: what was booked, when, and for how much.
  useEffect(() => {
    if (!bookingId) return;
    getBookingApi(bookingId)
      .then((b) => {
        setBooking(b);
        return getParkingSpotDetail(b.parking_spot_id).then((spot) => setSpotTitle(spot?.title ?? null));
      })
      .catch(() => {});
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;

    // One check at a time, and none once it's settled: a check (verify-status, then the
    // booking) can take longer than the interval, and two overlapping ones that both saw
    // the approval played the chime twice.
    let checking = false;
    let settled = false;
    const timer = setInterval(async () => {
      if (checking || settled) return;
      checking = true;
      pollCount.current += 1;
      try {
        // verify-status checks our DB first, then falls back to querying
        // MercadoPago directly — so it works even without a webhook.
        // The externalReference IS the bookingId (set in confirm.tsx).
        const res = await request<VerifyStatusResponse>('/payments/verify-status', {
          method: 'POST',
          body: JSON.stringify({ externalReference: bookingId }),
        });
        const mpStatus = res?.currentStatus;
        if (mpStatus === 'approved') {
          // An approved payment only means the booking is reserved if the booking
          // actually accepted it -- verify-status has already tried to confirm it by now.
          const latest = await getBookingApi(bookingId);
          setBooking(latest);
          if (PAID_BOOKING_STATUSES.has(latest.status)) {
            settled = true;
            clearInterval(timer);
            setAwaitingOwner(latest.status === 'PENDING_OWNER_APPROVAL');
            // The chime first, in the same moment the check mark appears.
            playApprovedRef.current();
            setApprovedAt(res?.transaction?.approved_at ?? latest.paid_at ?? null);
            setStatus('approved');
            return;
          }
          if (latest.status !== 'PENDING_PAYMENT') {
            // EXPIRED (the hold ran out before the payment landed) -- refunded.
            settled = true;
            clearInterval(timer);
            setStatus('refunded');
            return;
          }
          // Still PENDING_PAYMENT: the confirmation hit a transient error and the next
          // verify-status retries it -- keep polling (MAX_POLLS still bounds this).
        } else if (mpStatus === 'rejected' || mpStatus === 'cancelled' || mpStatus === 'refunded') {
          settled = true;
          clearInterval(timer);
          setStatus('rejected');
        }
        // 'pending', 'in_process', 'authorized' → keep polling
      } catch (err) {
        // Log so we can diagnose issues (404 = not found yet, 401 = auth issue, etc.)
        console.warn('[PaymentPending] poll error:', err);
      }
      checking = false;
      if (!settled && pollCount.current >= MAX_POLLS) {
        settled = true;
        clearInterval(timer);
        setStatus('unknown');
      }
    }, POLL_INTERVAL_MS);

    return () => {
      settled = true;
      clearInterval(timer);
    };
  }, [bookingId]);

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 24, paddingTop: sc(40), paddingBottom: 24, gap: sc(20) },
    heading: { alignItems: 'center', gap: 8 },
    title: { fontSize: sc(24), fontWeight: '800', color: colors.text, textAlign: 'center' },
    subtitle: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 },
    cardTitle: {
      fontSize: sc(12), fontWeight: '700', color: colors.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
    },
    note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
    noteText: { flex: 1, fontSize: sc(14), lineHeight: sc(20) },
    footer: {
      paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 4,
      borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
    },
  });

  // ---- What each state shows ----
  const steps: { label: string; state: StepState }[] = [
    // No "payment sent" step: until Mercado Pago approves it, nothing has been charged.
    {
      label: t(status === 'pending' ? 'driver.payment.result.stepMercadoPagoWaiting' : 'driver.payment.result.stepMercadoPago'),
      state: status === 'pending' ? 'current' : status === 'approved' || status === 'refunded' ? 'done' : 'upcoming',
    },
    ...(awaitingOwner ? [{ label: t('driver.payment.result.stepOwner'), state: 'current' as StepState }] : []),
    { label: t('driver.payment.result.stepReserved'), state: status === 'approved' && !awaitingOwner ? 'done' : 'upcoming' },
  ];

  const hero = {
    pending: { tone: colors.teal, icon: 'card-outline' as IconName },
    approved: { tone: SUCCESS, icon: 'checkmark' as IconName },
    rejected: { tone: DANGER, icon: 'close' as IconName },
    refunded: { tone: WARNING, icon: 'time-outline' as IconName },
    unknown: { tone: WARNING, icon: 'hourglass-outline' as IconName },
  }[status];

  const title = {
    pending: t('driver.payment.result.pendingTitle'),
    approved: awaitingOwner ? t('driver.payment.result.awaitingTitle') : t('driver.payment.result.approvedTitle'),
    rejected: t('driver.payment.result.rejectedTitle'),
    refunded: t('driver.payment.result.refundedTitle'),
    unknown: t('driver.payment.result.unknownTitle'),
  }[status];

  const subtitle = {
    pending: t('driver.payment.result.pendingBody'),
    approved: approvedAt ? formatPaidAt(approvedAt) : t('driver.payment.result.approvedBody'),
    rejected: t('driver.payment.result.rejectedBody'),
    refunded: t('driver.payment.result.refundedBody'),
    unknown: t('driver.payment.result.unknownBody'),
  }[status];

  const goToBooking = () => router.replace(`${group}/bookings/${bookingId}` as never);
  const goHome = () => router.replace(`${group}/(tabs)` as never);
  const goToBookings = () => router.replace(`${group}/(tabs)/bookings` as never);
  const goToSpot = () =>
    booking ? router.replace(`${group}/spot/${booking.parking_spot_id}` as never) : goHome();

  return (
    <Screen style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <StatusHero tone={hero.tone} icon={hero.icon} busy={status === 'pending'} key={status} />

        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {status === 'pending' || status === 'approved' ? (
          <View style={styles.card}>
            <Steps steps={steps} />
          </View>
        ) : null}

        {status === 'approved' && awaitingOwner ? (
          <View style={[styles.note, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
            <Ionicons name="person-outline" size={sc(18)} color={WARNING} />
            <Text style={[styles.noteText, { color: '#92400E' }]}>{t('driver.payment.result.awaitingNote')}</Text>
          </View>
        ) : null}

        {status === 'refunded' ? (
          <View style={[styles.note, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Ionicons name="return-down-back-outline" size={sc(18)} color={SUCCESS} />
            <Text style={[styles.noteText, { color: '#166534' }]}>{t('driver.payment.result.refundedNote')}</Text>
          </View>
        ) : null}

        {booking && status !== 'unknown' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('driver.payment.result.receiptTitle')}</Text>
            <Receipt
              booking={booking}
              spotTitle={spotTitle}
              showPaid={status === 'approved'}
              faded={status === 'rejected' || status === 'refunded'}
            />
          </View>
        ) : null}

        {status === 'pending' ? (
          <Text style={[styles.subtitle, { fontSize: sc(13) }]}>{t('driver.payment.result.pendingHint')}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {status === 'approved' ? (
          <>
            <Button title={t('driver.payment.result.viewBooking')} onPress={goToBooking} />
            <SecondaryAction label={t('driver.payment.result.goHome')} onPress={goHome} />
          </>
        ) : status === 'rejected' || status === 'refunded' ? (
          <>
            <Button title={t('driver.payment.result.backToSpot')} onPress={goToSpot} />
            <SecondaryAction label={t('driver.payment.result.goHome')} onPress={goHome} />
          </>
        ) : status === 'unknown' ? (
          <Button title={t('driver.booking.success.viewBookings')} onPress={goToBookings} />
        ) : (
          // Pending: nothing to cancel -- an unpaid hold just expires on its own
          // (POST /bookings/{id}/cancel doesn't take PENDING_PAYMENT).
          <SecondaryAction label={t('driver.booking.success.viewBookings')} onPress={goToBookings} />
        )}
      </View>
    </Screen>
  );
}

/** The big round status mark: springs in when the state changes; while waiting, a soft
 * ring pulses around it. */
function StatusHero({ tone, icon, busy }: { tone: string; icon: IconName; busy: boolean }) {
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  // Created once per mount (lazy state, not a ref read during render).
  const [appear] = useState(() => new Animated.Value(0.6));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [appear]);

  useEffect(() => {
    if (!busy) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  const size = sc(96);
  const styles = StyleSheet.create({
    wrap: { alignSelf: 'center', width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75, backgroundColor: `${tone}14` },
    pulse: { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: `${tone}33` },
    circle: { width: size, height: size, borderRadius: size / 2, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' },
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.halo} />
      {busy ? (
        <Animated.View
          style={[
            styles.pulse,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            },
          ]}
        />
      ) : null}
      <Animated.View style={[styles.circle, { transform: [{ scale: appear }] }]}>
        <Ionicons name={icon} size={sc(44)} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

/** The payment's progress, one row per step, joined by a line. */
function Steps({ steps }: { steps: { label: string; state: StepState }[] }) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: 12 },
    rail: { alignItems: 'center', width: sc(24) },
    dot: { width: sc(24), height: sc(24), borderRadius: sc(12), alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    line: { flex: 1, width: 2, minHeight: sc(14), marginVertical: 2 },
    currentDot: { width: sc(10), height: sc(10), borderRadius: sc(5), backgroundColor: colors.teal },
    label: { flex: 1, fontSize: sc(14), paddingTop: sc(2), paddingBottom: sc(14) },
  });
  return (
    <View>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const color = step.state === 'done' ? SUCCESS : step.state === 'current' ? colors.teal : colors.border;
        return (
          <View key={step.label} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { borderColor: color, backgroundColor: step.state === 'done' ? SUCCESS : colors.surface },
                ]}
              >
                {step.state === 'done' ? <Ionicons name="checkmark" size={sc(14)} color="#FFFFFF" /> : null}
                {step.state === 'current' ? <View style={styles.currentDot} /> : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: step.state === 'done' ? SUCCESS : colors.border }]} /> : null}
            </View>
            <Text
              style={[
                styles.label,
                { color: step.state === 'upcoming' ? colors.textSecondary : colors.text, fontWeight: step.state === 'current' ? '700' : '500' },
                last && { paddingBottom: 0 },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** What was booked: spot, when, vehicle and the amount (with how it was paid, once paid). */
function Receipt({
  booking,
  spotTitle,
  showPaid,
  faded,
}: {
  booking: BookingApiResponse;
  spotTitle: string | null;
  showPaid: boolean;
  faded: boolean;
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const when = formatWhen(booking);
  const vehicle = booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model} · ${booking.vehicle.plate}` : null;
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
    label: { width: sc(92), fontSize: sc(13), color: colors.textSecondary },
    value: { flex: 1, fontSize: sc(14), fontWeight: '600', color: colors.text, textAlign: 'right' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
    totalLabel: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    total: {
      fontSize: sc(20), fontWeight: '800', color: faded ? colors.textSecondary : colors.teal,
      textDecorationLine: faded ? 'line-through' : 'none',
    },
    method: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flex: 1 },
    methodText: { fontSize: sc(14), fontWeight: '600', color: colors.text },
  });
  return (
    <View>
      {spotTitle ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('driver.payment.result.spot')}</Text>
          <Text style={styles.value}>{spotTitle}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.label}>{t('driver.payment.result.when')}</Text>
        <Text style={styles.value}>{when}</Text>
      </View>
      {vehicle ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('driver.payment.result.vehicle')}</Text>
          <Text style={styles.value}>{vehicle}</Text>
        </View>
      ) : null}
      {showPaid ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('driver.payment.result.method')}</Text>
          <View style={styles.method}>
            <MercadoPagoLogo size={sc(20)} />
            <Text style={styles.methodText} numberOfLines={1}>Mercado Pago</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.divider} />
      <View style={[styles.row, { alignItems: 'center' }]}>
        <Text style={[styles.label, styles.totalLabel]}>
          {showPaid ? t('driver.payment.result.totalPaid') : t('driver.payment.result.total')}
        </Text>
        <Text style={[styles.value, styles.total]}>{formatPesos(booking.amount)}</Text>
      </View>
    </View>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: sc(12), alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ fontSize: sc(15), fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}
