import { t, useLanguage } from '@/src/i18n';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

/**
 * Landing screen for a booking paid in cash -- no Mercado Pago checkout, no
 * payment/pending.tsx polling (there's no payment to poll), so this is
 * reached straight from confirm.tsx/confirm-stay.tsx once the booking is
 * created and confirmed with CASH_PAYMENT_ID. Same "esperando al
 * propietario" state payment/pending.tsx shows after a card payment is
 * acknowledged, minus the "ya pagaste" step that doesn't apply here.
 */
export default function CashPendingScreen() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const { total } = useLocalSearchParams<{ total: string }>();

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

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusIcon variant="unknown" />
      <Text style={typography.h1}>{t('driver.booking.pendingOwnerApproval.title')}</Text>
      <Card style={styles.card}>
        <Text style={typography.body}>
          {t('driver.booking.cashPending.body', { total })}
        </Text>
      </Card>
      <Button
        title={t('driver.booking.success.viewBookings')}
        onPress={() => router.replace(`${group}/(tabs)/bookings`)}
      />
    </Screen>
  );
}
