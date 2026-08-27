import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getDriverBookingById, DriverBookingSummary } from '@/src/services/bookingService';

export default function DriverBookingDetail() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<DriverBookingSummary | null>(null);

  useEffect(() => {
    getDriverBookingById(id).then(setBooking).catch(() => setBooking(null));
  }, [id]);

  if (!booking) return null;

  // Cancel is still mocked -- only local UI state, no real cancel request
  // (out of scope for this pass, see booking-service/parking-service/gateway
  // PRs for the view-only history endpoints this screen now reads from).
  function onCancel() {
    setBooking((current) => (current ? { ...current, status: 'CANCELLED' } : current));
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  });

  return (
    <Screen style={styles.container}>
      <Card>
        <View style={styles.row}>
          <Text style={typography.h1}>{booking.parkingSpotTitle}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <Text style={typography.body}>
          {booking.date} · {booking.startTime} {t('driver.booking.timeTo')} {booking.endTime}
        </Text>
        <Text style={typography.body}>{t('driver.booking.total')}: ${booking.total}</Text>
      </Card>
      {booking.status === 'CONFIRMED' && (
        <Button
          title={t('driver.booking.cancel.title')}
          onPress={() =>
            Alert.alert(t('driver.booking.cancel.title'), t('driver.booking.cancel.confirm'), [
              { text: t('common.no') },
              { text: t('driver.booking.cancel.yes'), onPress: onCancel },
            ])
          }
        />
      )}
      {booking.status === 'COMPLETED' && (
        <Button
          title={t('driver.rating.title')}
          onPress={() => router.push(`/(driver)/review/${booking.id}`)}
        />
      )}
    </Screen>
  );
}
