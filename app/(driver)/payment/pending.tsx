import { t, useLanguage } from '@/src/i18n';
import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { request } from '@/src/api/client';
import { getBookingApi } from '@/src/api/booking';

type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'unknown';

interface VerifyStatusResponse {
  currentStatus: string;
  transaction?: { approved_at?: string | null } | null;
}

function formatApprovedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// Poll every 2 seconds, up to 2 minutes (60 attempts).
// Uses POST /payments/verify-status which queries MercadoPago directly if the
// transaction isn't in our DB yet — works even when the webhook hasn't arrived
// (e.g. WEBHOOK_BASE_URL is localhost and MP can't reach it in dev).
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60; // 2 minutes max

export default function PaymentPendingScreen() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [status, setStatus] = useState<PaymentStatus>('pending');
  // Set only once the payment itself is approved -- distinguishes a spot
  // that auto-confirms from one where the owner still has to sign off.
  const [awaitingOwner, setAwaitingOwner] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  // Payment approval shows its own confirmation step first ("pagaste el
  // <fecha>, ya está reservado" + Continuar) before revealing what comes
  // next -- the owner-approval notice, or (tapping Continuar) home.
  const [acknowledged, setAcknowledged] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!bookingId) return;

    const timer = setInterval(async () => {
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
          clearInterval(timer);
          setStatus('approved');
          setApprovedAt(res?.transaction?.approved_at ?? null);
          try {
            const booking = await getBookingApi(bookingId);
            setAwaitingOwner(booking.status === 'PENDING_OWNER_APPROVAL');
          } catch {
            // Booking fetch failing doesn't change the payment outcome --
            // worst case the driver sees the generic "confirmada" message.
          }
        } else if (mpStatus === 'rejected' || mpStatus === 'cancelled' || mpStatus === 'refunded') {
          clearInterval(timer);
          setStatus('rejected');
        }
        // 'pending', 'in_process', 'authorized' → keep polling
      } catch (err) {
        // Log so we can diagnose issues (404 = not found yet, 401 = auth issue, etc.)
        console.warn('[PaymentPending] poll error:', err);
      }
      if (pollCount.current >= MAX_POLLS) {
        clearInterval(timer);
        setStatus('unknown');
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [bookingId]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    card: { width: '100%', marginVertical: 12 },
  });

  if (status === 'approved' && !acknowledged) {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusIcon variant="success" />
        <Text style={typography.h1}>{t('driver.payment.confirmed.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>
            {approvedAt
              ? t('driver.payment.confirmed.bodyWithDate', { date: formatApprovedAt(approvedAt) })
              : t('driver.payment.approved')}
          </Text>
        </Card>
        <Button
          title={t('common.continue')}
          onPress={() => {
            if (awaitingOwner) {
              setAcknowledged(true);
            } else {
              router.replace(`${group}/(tabs)`);
            }
          }}
        />
      </Screen>
    );
  }

  if (status === 'approved' && acknowledged) {
    // Only reached when awaitingOwner is true -- the else branch above
    // (nothing left to confirm) goes straight home instead.
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusIcon variant="unknown" />
        <Text style={typography.h1}>{t('driver.booking.pendingOwnerApproval.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>{t('driver.booking.pendingOwnerApproval.body')}</Text>
        </Card>
        <Button
          title={t('driver.booking.success.viewBookings')}
          onPress={() => router.replace(`${group}/(tabs)/bookings`)}
        />
      </Screen>
    );
  }

  if (status === 'rejected') {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusIcon variant="error" />
        <Text style={typography.h1}>{t('driver.payment.rejected.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>{t('driver.payment.rejected.body')}</Text>
        </Card>
        <Button
          title={t('driver.payment.rejected.retry')}
          onPress={() => router.replace(`${group}/(tabs)`)}
        />
      </Screen>
    );
  }

  if (status === 'unknown') {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusIcon variant="unknown" />
        <Text style={typography.h1}>{t('driver.payment.unknown.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>{t('driver.payment.unknown.body')}</Text>
        </Card>
        <Button
          title={t('driver.booking.success.viewBookings')}
          onPress={() => router.replace(`${group}/(tabs)/bookings`)}
        />
      </Screen>
    );
  }

  // Pending: show spinner while polling + cancel button
  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <ActivityIndicator size="large" color={colors.teal} />
      <Text style={typography.h2}>{t('driver.payment.pending.title')}</Text>
      <Text style={[typography.body, { textAlign: 'center' }]}>{t('driver.payment.pending.body')}</Text>
      <Button
        title={t('common.cancel')}
        onPress={() => router.replace(`${group}/(tabs)`)}
        style={{ marginTop: 24, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#888' }}
      />
    </Screen>
  );
}
