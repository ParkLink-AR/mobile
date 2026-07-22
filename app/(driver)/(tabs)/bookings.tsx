import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingsForUser } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function DriverBookings() {
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) getBookingsForUser(user.id, 'driver').then(setBookings);
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
      <Text style={typography.h1}>Mis reservas</Text>
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
                {item.date} · {item.startTime} a {item.endTime}
              </Text>
              <Text style={styles.total}>${item.total}</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
