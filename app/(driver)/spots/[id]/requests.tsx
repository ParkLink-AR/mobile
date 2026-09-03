import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getBookingsForSpotApi, approveBookingApi, rejectBookingApi, BookingApiResponse } from '@/src/api/booking';
import { getPublicProfileApi } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { Booking } from '@/src/types';

function mapApiBooking(b: BookingApiResponse): Booking {
  const start = new Date(b.start);
  const end = new Date(b.end);
  const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / 3_600_000));
  const dateISO = b.start.slice(0, 10);
  const startTime = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0;

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: '',
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

export default function SpotBookingRequests() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getBookingsForSpotApi(id)
      .then((list) => {
        const mapped = list.map(mapApiBooking);
        setBookings(mapped);

        const driverIds = [...new Set(mapped.map((b) => b.driverId))];
        Promise.allSettled(
          driverIds.map((driverId) =>
            getPublicProfileApi(driverId).then((profile) => {
              setDriverNames((prev) => ({ ...prev, [driverId]: profile.name }));
            }),
          ),
        );
      })
      .catch((err) => console.warn('[SpotBookingRequests] fetch error:', err));
  }, [id]);

  useFocusEffect(load);

  async function handleApprove(bookingId: string) {
    setBusyId(bookingId);
    try {
      await approveBookingApi(bookingId);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorApprove'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(bookingId: string) {
    setBusyId(bookingId);
    try {
      await rejectBookingApi(bookingId);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorReject'));
    } finally {
      setBusyId(null);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    driverRowText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    total: { color: colors.teal, fontWeight: '700', marginTop: 4 },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 10,
    },
    approveBtn: { backgroundColor: colors.teal },
    rejectBtn: { borderWidth: 1.5, borderColor: '#C62828' },
    approveBtnText: { color: colors.white, fontWeight: '700' },
    rejectBtnText: { color: '#C62828', fontWeight: '700' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('owner.spot.requests.title')}</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('owner.spot.requests.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <TouchableOpacity
              style={styles.driverRow}
              onPress={() => router.push(`/(driver)/profile/${item.driverId}?as=driver`)}
              disabled={!driverNames[item.driverId]}
            >
              <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.driverRowText}>{driverNames[item.driverId] ?? item.driverId}</Text>
              {!!driverNames[item.driverId] && <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />}
            </TouchableOpacity>
            <View style={styles.row}>
              <Text style={typography.body}>
                {item.date} · {item.startTime} {t('driver.booking.timeTo')} {item.endTime}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.total}>${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>

            {item.status === 'PENDING_OWNER_APPROVAL' && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(item.id)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color="#C62828" size="small" />
                  ) : (
                    <>
                      <Ionicons name="close" size={16} color="#C62828" />
                      <Text style={styles.rejectBtnText}>{t('owner.spot.requests.reject')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApprove(item.id)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                      <Text style={styles.approveBtnText}>{t('owner.spot.requests.approve')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}
      />
    </Screen>
  );
}
