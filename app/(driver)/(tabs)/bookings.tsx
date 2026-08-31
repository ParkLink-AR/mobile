import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getUserBookingsApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';
import { Booking } from '@/src/types';

/** Maps the backend wire shape to the UI Booking type. */
function mapApiBooking(b: BookingApiResponse, spotTitle: string): Booking {
  const start = new Date(b.start);
  const end = new Date(b.end);
  const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / 3_600_000));
  const dateISO = b.start.slice(0, 10);
  const startTime = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0; // centavos → pesos

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: spotTitle,
    driverId: b.user_id,
    driverName: '',
    ownerId: '',
    date: dateISO,
    startTime,
    endTime,
    hours,
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    status: b.status as Booking['status'],
  };
}

export default function DriverBookings() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getUserBookingsApi(user.id)
        .then(async (list) => {
          // Deduplicate spot ids and fetch titles in parallel
          const uniqueSpotIds = [...new Set(list.map((b) => b.parking_spot_id))];
          const spotTitleMap: Record<string, string> = {};
          await Promise.allSettled(
            uniqueSpotIds.map((id) =>
              getParkingSpotDetail(id)
                .then((spot) => { spotTitleMap[id] = spot.title; })
                .catch(() => { spotTitleMap[id] = id; }) // fallback to id on error
            )
          );
          setBookings(list.map((b) => mapApiBooking(b, spotTitleMap[b.parking_spot_id] ?? b.parking_spot_id)));
        })
        .catch((err) => console.warn('[Bookings] fetch error:', err));
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    total: { color: colors.teal, fontWeight: '700', marginTop: 4 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('driver.bookings.title')}</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(driver)/bookings/${item.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={typography.h2}>{item.parkingSpotTitle}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={typography.caption}>
                {item.date} · {item.startTime} {t('driver.booking.timeTo')} {item.endTime}
              </Text>
              <Text style={styles.total}>${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
