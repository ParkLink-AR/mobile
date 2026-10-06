import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { RoleBadge } from '@/src/components/RoleBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getOwnerBookings } from '@/src/services/ownerBookings';
import { getPublicProfileApi } from '@/src/api/auth';
import { todayArtDateISO } from '@/src/services/dateUtils';
import { formatBookingWhen, formatShortDate } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';

export default function OwnerToday() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
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

  // What the owner earns, not what drivers paid (that includes ParkLink's commission).
  const totalToday = bookings.reduce((sum, b) => sum + (b.ownerEarnings ?? b.total), 0);
  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    dateLabel: { fontSize: sc(13), color: colors.textSecondary, textTransform: 'capitalize' },
    statsRow: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4,
    },
    statValue: { fontSize: sc(22), fontWeight: '700', color: colors.text },
    statLabel: { fontSize: sc(12), color: colors.textSecondary },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    sectionTitle: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
    emptyCard: {
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 24, alignItems: 'center', gap: 8,
    },
    emptyText: { fontSize: sc(14), color: colors.textSecondary, textAlign: 'center' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bookingCard: { gap: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    driverRowText: { fontSize: sc(13), fontWeight: '600', color: colors.textSecondary },
    spotTitle: { fontSize: sc(15), fontWeight: '700', color: colors.text, flex: 1 },
    stayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stayLabel: { flex: 1, fontSize: sc(13), color: colors.textSecondary },
    stayValue: { fontSize: sc(13), fontWeight: '600', color: colors.text },
  });

  return (
    <Screen style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 4 }}>
            <View>
              <View style={styles.headerRow}>
                <Text style={typography.h1}>{t('tabs.owner.today')}</Text>
                <RoleBadge />
              </View>
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
              <Ionicons name="today-outline" size={sc(32)} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{t('owner.today.empty')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`${group}/bookings/${item.id}`)}>
            <Card style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.spotTitle}>{item.parkingSpotTitle}</Text>
                <StatusBadge status={item.status} />
              </View>
              <View style={styles.driverRow}>
                <Ionicons name="person-circle-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.driverRowText}>{driverNames[item.driverId] ?? item.driverId}</Text>
              </View>
              {item.date === item.endDate ? (
                <View style={styles.stayRow}>
                  <Ionicons name="time-outline" size={sc(15)} color={colors.textSecondary} />
                  <Text style={typography.body}>
                    {formatBookingWhen(item, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'))}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.stayRow}>
                    <Ionicons name="log-in-outline" size={sc(15)} color={colors.textSecondary} />
                    <Text style={styles.stayLabel}>{t('spot.stay.checkIn')}</Text>
                    <Text style={styles.stayValue}>{formatShortDate(item.date)} · {item.startTime}</Text>
                  </View>
                  <View style={styles.stayRow}>
                    <Ionicons name="log-out-outline" size={sc(15)} color={colors.textSecondary} />
                    <Text style={styles.stayLabel}>{t('spot.stay.checkOut')}</Text>
                    <Text style={styles.stayValue}>{formatShortDate(item.endDate)} · {item.endTime}</Text>
                  </View>
                </>
              )}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
