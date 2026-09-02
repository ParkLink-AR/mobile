import { t, useLanguage } from '@/src/i18n';
import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { request } from '@/src/api/client';

type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'unknown';

interface VerifyStatusResponse {
  currentStatus: string;
}

// Poll every 2 seconds, up to 2 minutes (60 attempts).
// Uses POST /payments/verify-status which queries MercadoPago directly if the
// transaction isn't in our DB yet — works even when the webhook hasn't arrived
// (e.g. WEBHOOK_BASE_URL is localhost and MP can't reach it in dev).
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60; // 2 minutes max

export default function PaymentPendingScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [status, setStatus] = useState<PaymentStatus>('pending');
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

  if (status === 'approved') {
    return (
      <Screen style={styles.container}>
        <StatusIcon variant="success" />
        <Text style={typography.h1}>{t('driver.booking.success.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>{t('driver.payment.approved')}</Text>
        </Card>
        <Button
          title={t('driver.booking.success.viewBookings')}
          onPress={() => router.replace('/(driver)/(tabs)/bookings')}
        />
      </Screen>
    );
  }

  if (status === 'rejected') {
    return (
      <Screen style={styles.container}>
        <StatusIcon variant="error" />
        <Text style={typography.h1}>{t('driver.payment.rejected.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>{t('driver.payment.rejected.body')}</Text>
        </Card>
        <Button
          title={t('driver.payment.rejected.retry')}
          onPress={() => router.replace('/(driver)/(tabs)/index')}
        />
      </Screen>
    );
  }

  if (status === 'unknown') {
    return (
      <Screen style={styles.container}>
        <StatusIcon variant="unknown" />
        <Text style={typography.h1}>{t('driver.payment.unknown.title')}</Text>
        <Card style={styles.card}>
          <Text style={typography.body}>{t('driver.payment.unknown.body')}</Text>
        </Card>
        <Button
          title={t('driver.booking.success.viewBookings')}
          onPress={() => router.replace('/(driver)/(tabs)/bookings')}
        />
      </Screen>
    );
  }

  // Pending: show spinner while polling + cancel button
  return (
    <Screen style={styles.container}>
      <ActivityIndicator size="large" color={colors.teal} />
      <Text style={typography.h2}>{t('driver.payment.pending.title')}</Text>
      <Text style={[typography.body, { textAlign: 'center' }]}>{t('driver.payment.pending.body')}</Text>
      <Button
        title={t('common.cancel')}
        onPress={() => router.replace('/(driver)/(tabs)/index')}
        style={{ marginTop: 24, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#888' }}
      />
    </Screen>
  );
}
