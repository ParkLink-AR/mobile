import { t, useLanguage } from '@/src/i18n';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

export default function BookingSuccess() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const { spotTitle, date, startTime, endTime, total } = useLocalSearchParams<{
    spotTitle: string;
    date: string;
    startTime: string;
    endTime: string;
    total: string;
  }>();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, alignItems: 'center', gap: 16 },
    card: { width: '100%', marginVertical: 12 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusIcon variant="success" />
      <Text style={typography.h1}>{t('driver.booking.success.title')}</Text>
      <Card style={styles.card}>
        <Text style={typography.h2}>{spotTitle}</Text>
        <Text style={typography.body}>
          {date} · {startTime} {t('driver.booking.timeTo')} {endTime}
        </Text>
        <Text style={typography.body}>{t('driver.booking.totalPaid').replace('%{total}', total)}</Text>
      </Card>
      <Button
        title={t('driver.booking.success.viewBookings')}
        onPress={() => router.replace(`${group}/(tabs)/bookings`)}
      />
    </Screen>
  );
}
