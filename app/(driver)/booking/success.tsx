import { t } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getBookingById } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function BookingSuccess() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    getBookingById(bookingId).then((b) => setBooking(b ?? null));
  }, [bookingId]);

  if (!booking) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, alignItems: 'center', gap: 16 },
    check: { fontSize: 56, color: colors.success },
    card: { width: '100%', marginVertical: 12 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={typography.h1}>¡Reserva confirmada!</Text>
      <Card style={styles.card}>
        <Text style={typography.h2}>{booking.parkingSpotTitle}</Text>
        <Text style={typography.body}>
          {booking.date} · {booking.startTime} a {booking.endTime}
        </Text>
        <Text style={typography.body}>Total pagado: ${booking.total}</Text>
      </Card>
      <Button
        title={t('driver.booking.success.viewBookings')}
        onPress={() => router.replace('/(driver)/(tabs)/bookings')}
      />
    </Screen>
  );
}
