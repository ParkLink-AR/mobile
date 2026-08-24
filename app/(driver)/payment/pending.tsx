import { t, useLanguage } from '@/src/i18n';
import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { request } from '@/src/api/client';

type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'unknown';

interface TransactionResponse {
  status: string;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 15; // 1 minute max

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
        // The external_reference in payment-service IS the bookingId
        const tx = await request<TransactionResponse>(
          `/payments/external-reference/${bookingId}`
        );
        if (tx?.status === 'approved') {
          clearInterval(timer);
          setStatus('approved');
        } else if (tx?.status === 'rejected' || tx?.status === 'cancelled') {
          clearInterval(timer);
          setStatus('rejected');
        }
      } catch {
        // Not found yet – keep polling
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
    icon: { fontSize: 56 },
    card: { width: '100%', marginVertical: 12 },
  });

  if (status === 'approved') {
    return (
      <Screen style={styles.container}>
        <Text style={[styles.icon, { color: colors.success }]}>✓</Text>
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
        <Text style={[styles.icon, { color: colors.warning }]}>✗</Text>
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
        <Text style={[styles.icon, { color: colors.textSecondary }]}>?</Text>
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

  // Pending: show spinner while polling
  return (
    <Screen style={styles.container}>
      <ActivityIndicator size="large" color={colors.teal} />
      <Text style={typography.h2}>{t('driver.payment.pending.title')}</Text>
      <Text style={[typography.body, { textAlign: 'center' }]}>{t('driver.payment.pending.body')}</Text>
    </Screen>
  );
}
