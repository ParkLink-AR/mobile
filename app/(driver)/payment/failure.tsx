import { t, useLanguage } from '@/src/i18n';
import { Text, StyleSheet } from 'react-native';
import { router, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

// Deep-link handler for parklink://payment/failure
// MP redirects here when a payment is rejected or cancelled.
export default function PaymentFailureScreen() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 },
    card: { width: '100%', marginVertical: 12 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusIcon variant="error" />
      <Text style={typography.h1}>{t('driver.payment.rejected.title')}</Text>
      <Card style={styles.card}>
        <Text style={typography.body}>{t('driver.payment.rejected.body')}</Text>
      </Card>
      <Button
        title={t('driver.payment.rejected.retry')}
        onPress={() => router.replace(`${group}/(tabs)/index`)}
      />
    </Screen>
  );
}
