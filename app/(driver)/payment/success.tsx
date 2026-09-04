import { t, useLanguage } from '@/src/i18n';
import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

// Deep-link handler for parklink://payment/success
// MP redirects here after a successful payment. We just show a confirmation
// and send the user to their bookings list.
export default function PaymentSuccessScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 },
    card: { width: '100%', marginVertical: 12 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
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
