import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getUserBookingsApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotsByIds } from '@/src/api/parking';
import { mapBookingDateRange, formatBookingWhen } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';

/** Maps the backend wire shape to the UI Booking type. */
function mapApiBooking(b: BookingApiResponse, spotTitle: string): Booking {
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0; // centavos → pesos

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: spotTitle,
    driverId: b.user_id,
    driverName: '',
    ownerId: '',
    kind: b.kind,
    ...mapBookingDateRange(b.start, b.end),
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    status: b.status as Booking['status'],
    verificationCode: b.verification_code,
  };
}

export default function DriverBookings() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getUserBookingsApi(user.id)
        .then(async (list) => {
          // Deduplicate spot ids and fetch all their titles in a single batch request
          const uniqueSpotIds = [...new Set(list.map((b) => b.parking_spot_id))];
          const spots = await getParkingSpotsByIds(uniqueSpotIds).catch(() => []);
          const spotTitleMap: Record<string, string> = Object.fromEntries(
            spots.map((spot) => [spot.id, spot.title]),
          );
          // Any id not found by the batch call (deleted spot, etc.) falls back to showing the id
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
    codeChip: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.teal,
    },
    codeChipText: { color: colors.teal, fontWeight: '700', fontSize: 12 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('driver.bookings.title')}</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('driver.bookings.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`${group}/bookings/${item.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={typography.h2}>{item.parkingSpotTitle}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={typography.caption}>
                {formatBookingWhen(item, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'))}
              </Text>
              <Text style={styles.total}>${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              {item.status === 'CONFIRMED' && item.verificationCode && (
                <View style={styles.codeChip}>
                  <Text style={styles.codeChipText}>{t('driver.booking.code', { code: item.verificationCode })}</Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
