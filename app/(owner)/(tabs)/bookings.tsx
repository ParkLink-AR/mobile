import { useCallback, useState } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingsForUser } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function OwnerBookings() {
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [sections, setSections] = useState<{ title: string; data: Booking[] }[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getBookingsForUser(user.id, 'owner').then((all) => {
        const upcoming = all.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT');
        const history = all.filter((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'EXPIRED');
        setSections([
          { title: 'PRÓXIMAS', data: upcoming },
          { title: 'HISTORIAL', data: history },
        ]);
      });
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    sectionTitle: { marginTop: 8, marginBottom: 4 },
    card: { marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    total: { color: colors.teal, fontWeight: '700' },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>Reservas recibidas</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.data.length > 0 ? (
            <Text style={[typography.caption, styles.sectionTitle]}>{section.title}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={typography.h2}>{item.driverName}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={typography.caption}>{item.parkingSpotTitle}</Text>
            <View style={styles.row}>
              <Text style={typography.caption}>
                {item.date} · {item.startTime} a {item.endTime}
              </Text>
              <Text style={styles.total}>${item.total}</Text>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
