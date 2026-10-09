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
import { approveBookingApi, rejectBookingApi } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';
import { getPublicProfileApi } from '@/src/api/auth';
import { artDateFromISO, todayArtDateISO } from '@/src/services/dateUtils';
import { formatBookingWhen, formatLongDate, formatShortDate, formatShortDateFromISO, formatTime } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';
import { vehicleSummary } from '@/src/components/VehicleIdentity';

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
  // Booking requests (PENDING_OWNER_APPROVAL) across every spot, soonest deadline first --
  // they're auto-cancelled if left unanswered, so they lead the screen.
  const [requests, setRequests] = useState<Booking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const markAnswered = useNotificationsStore((s) => s.markAnswered);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getOwnerBookings(user.id)
      .then((all) => {
        const today = todayArtDateISO();
        const todays = all.filter((b) => b.date === today && b.status !== 'PENDING_OWNER_APPROVAL');
        setBookings(todays);
        const pending = all
          .filter((b) => b.status === 'PENDING_OWNER_APPROVAL')
          .sort((a, b) => (a.ownerResponseDeadline ?? '').localeCompare(b.ownerResponseDeadline ?? ''));
        setRequests(pending);

        const driverIds = [...new Set([...todays, ...pending].map((b) => b.driverId))];
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

  async function answerRequest(bookingId: string, approve: boolean) {
    setBusyId(bookingId);
    try {
      await (approve ? approveBookingApi(bookingId) : rejectBookingApi(bookingId));
      load();
      markAnswered(bookingId);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t(approve ? 'owner.spot.requests.errorApprove' : 'owner.spot.requests.errorReject'));
    } finally {
      setBusyId(null);
    }
  }

  /** "hoy a las 14:00" / "el 07/10/2026 a las 14:00" */
  function respondByLabel(deadline: string): string {
    const time = formatTime(deadline);
    if (artDateFromISO(deadline) === todayArtDateISO()) {
      return t('owner.requests.respondByToday', { time });
    }
    return t('owner.requests.respondByDate', { date: formatShortDateFromISO(deadline), time });
  }

  if (!user) return null;

  // What the owner earns, not what drivers paid (that includes ParkLink's commission).
  const totalToday = bookings.reduce((sum, b) => sum + (b.ownerEarnings ?? b.total), 0);
  const todayLabel = formatLongDate(todayArtDateISO());

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    dateLabel: { fontSize: sc(13), color: colors.textSecondary },
    statsRow: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4,
    },
    statValue: { fontSize: sc(22), fontWeight: '700', color: colors.text },
    statLabel: { fontSize: sc(12), color: colors.textSecondary },
    financesShortcut: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.teal + '14', borderRadius: 12,
      paddingVertical: 10, paddingHorizontal: 12,
    },
    financesShortcutText: { flex: 1, fontSize: sc(13), fontWeight: '600', color: colors.teal },
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
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    requestsList: { gap: 10 },
    requestCard: { gap: 6, borderWidth: 1, borderColor: colors.warning },
    requestSpotTitle: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    vehicleText: { fontSize: sc(13), color: colors.textSecondary },
    earnText: { fontSize: sc(14), fontWeight: '700', color: colors.teal },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    deadlineText: { fontSize: sc(13), fontWeight: '600', color: colors.warning },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 10,
    },
    approveBtn: { backgroundColor: colors.teal },
    rejectBtn: { borderWidth: 1.5, borderColor: '#C62828' },
    approveBtnText: { color: colors.white, fontWeight: '700', fontSize: sc(14) },
    rejectBtnText: { color: '#C62828', fontWeight: '700', fontSize: sc(14) },
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

            {requests.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('owner.requests.pendingSection', { count: requests.length })}</Text>
                  <View style={styles.sectionLine} />
                </View>
                <View style={styles.requestsList}>
                  {requests.map((item) => (
                    <Pressable key={item.id} onPress={() => router.push(`${group}/bookings/${item.id}`)}>
                      <Card style={styles.requestCard}>
                        <Text style={styles.requestSpotTitle}>{item.parkingSpotTitle}</Text>
                        <View style={styles.driverRow}>
                          <Ionicons name="person-circle-outline" size={sc(16)} color={colors.textSecondary} />
                          <Text style={styles.driverRowText}>{driverNames[item.driverId] ?? item.driverId}</Text>
                        </View>
                        {item.vehicle && (
                          <View style={styles.vehicleRow}>
                            <Ionicons name="car-outline" size={sc(16)} color={colors.textSecondary} />
                            <Text style={styles.vehicleText}>{vehicleSummary(item.vehicle)}</Text>
                          </View>
                        )}
                        <Text style={typography.body}>
                          {formatBookingWhen(item, t('driver.booking.timeTo'), t('spot.stay.checkIn'), t('spot.stay.checkOut'))}
                        </Text>
                        <Text style={styles.earnText}>
                          {t('owner.booking.youEarn', {
                            amount: (item.ownerEarnings ?? item.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          })}
                        </Text>
                        {item.ownerResponseDeadline && (
                          <View style={styles.deadlineRow}>
                            <Ionicons name="time-outline" size={sc(15)} color={colors.warning} />
                            <Text style={styles.deadlineText}>{respondByLabel(item.ownerResponseDeadline)}</Text>
                          </View>
                        )}
                        <View style={styles.actionsRow}>
                          <Pressable
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => answerRequest(item.id, false)}
                            disabled={busyId === item.id}
                          >
                            {busyId === item.id ? (
                              <ActivityIndicator color="#C62828" size="small" />
                            ) : (
                              <>
                                <Ionicons name="close" size={sc(16)} color="#C62828" />
                                <Text style={styles.rejectBtnText}>{t('owner.spot.requests.reject')}</Text>
                              </>
                            )}
                          </Pressable>
                          <Pressable
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={() => answerRequest(item.id, true)}
                            disabled={busyId === item.id}
                          >
                            {busyId === item.id ? (
                              <ActivityIndicator color={colors.white} size="small" />
                            ) : (
                              <>
                                <Ionicons name="checkmark" size={sc(16)} color={colors.white} />
                                <Text style={styles.approveBtnText}>{t('owner.spot.requests.approve')}</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

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

            <Pressable
              style={({ pressed }) => [styles.financesShortcut, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => router.push(`${group}/finances`)}
            >
              <Ionicons name="trending-up-outline" size={sc(16)} color={colors.teal} />
              <Text style={styles.financesShortcutText}>{t('owner.today.financesShortcut')}</Text>
              <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
            </Pressable>

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
                    <Text style={styles.stayValue}>{formatShortDate(item.date)} {item.startTime}</Text>
                  </View>
                  <View style={styles.stayRow}>
                    <Ionicons name="log-out-outline" size={sc(15)} color={colors.textSecondary} />
                    <Text style={styles.stayLabel}>{t('spot.stay.checkOut')}</Text>
                    <Text style={styles.stayValue}>{formatShortDate(item.endDate)} {item.endTime}</Text>
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
