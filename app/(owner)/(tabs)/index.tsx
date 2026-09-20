import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getOwnerBookings } from '@/src/services/ownerBookings';
import { getPublicProfileApi } from '@/src/api/auth';
import { todayArtDateISO } from '@/src/services/dateUtils';
import { formatBookingWhen } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';

export default function OwnerToday() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getOwnerBookings(user.id)
      .then((all) => {
        const today = todayArtDateISO();
        const todays = all.filter((b) => b.date === today);
        setBookings(todays);

        const driverIds = [...new Set(todays.map((b) => b.driverId))];
        Promise.allSettled(
          driverIds.map((driverId) =>
            getPublicProfileApi(driverId).then((profile) => {
              setDriverNames((prev) => ({ ...prev, [driverId]: profile.name }));
            }),
          ),
        );
      })
      .catch((err) => console.warn('[OwnerToday] fetch error:', err))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useFocusEffect(load);

  if (!user) return null;

  const totalToday = bookings.reduce((sum, b) => sum + b.total, 0);
  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 80, gap: 16 },
    dateLabel: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
    statsRow: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4,
    },
    statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
    emptyCard: {
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 24, alignItems: 'center', gap: 8,
    },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    bookingCard: { gap: 6 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    driverRowText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    spotTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 4 }}>
            <View>
              <Text style={typography.h1}>{t('tabs.owner.today')}</Text>
              <Text style={styles.dateLabel}>{todayLabel}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{bookings.length}</Text>
                <Text style={styles.statLabel}>{t('owner.today.bookingsCount')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  ${totalToday.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.statLabel}>{t('owner.today.earnings')}</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('owner.today.bookingsSection')}</Text>
              <View style={styles.sectionLine} />
            </View>

            {loading && bookings.length === 0 && (
              <ActivityIndicator color={colors.teal} style={{ marginTop: 8 }} />
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Ionicons name="today-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{t('owner.today.empty')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`${group}/bookings/${item.id}`)}>
            <Card style={styles.bookingCard}>
              <Text style={styles.spotTitle}>{item.parkingSpotTitle}</Text>
              <View style={styles.driverRow}>
                <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.driverRowText}>{driverNames[item.driverId] ?? item.driverId}</Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={typography.body}>
                  {formatBookingWhen(item, t('driver.booking.timeTo'))}
                </Text>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
