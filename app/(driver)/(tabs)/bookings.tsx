import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { DropdownSelect } from '@/src/components/DropdownSelect';
import { StatusBadge } from '@/src/components/StatusBadge';
import { RoleBadge } from '@/src/components/RoleBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getUserBookingsApi, BookingApiResponse, BookingsSort } from '@/src/api/booking';
import { getParkingSpotsByIds } from '@/src/api/parking';
import { mapBookingDateRange, formatBookingWhen, toVehicleSnapshot } from '@/src/services/bookingDates';
import { Booking, BookingStatus } from '@/src/types';
import { PaymentDueHint } from '@/src/components/PaymentDue';

/** The statuses a driver can filter their bookings by (expired checkouts never show up). */
const FILTER_STATUSES: BookingStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_OWNER_APPROVAL',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

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
    holdExpiresAt: b.hold_expires_at,
    vehicle: toVehicleSnapshot(b.vehicle),
  };
}

export default function DriverBookings() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<BookingsSort>('recent');
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      // Switching the order again before this answers discards it, so it can't overwrite the new one.
      let active = true;
      setLoading(true);
      getUserBookingsApi(user.id, sort, status)
        .then(async (list) => {
          // Deduplicate spot ids and fetch all their titles in a single batch request
          const uniqueSpotIds = [...new Set(list.map((b) => b.parking_spot_id))];
          // Deleted spots too: a booking still has to say which spot it was for.
          const spots = await getParkingSpotsByIds(uniqueSpotIds, { includeDeleted: true }).catch(() => []);
          const spotTitleMap: Record<string, string> = Object.fromEntries(
            spots.map((spot) => [spot.id, spot.title]),
          );
          // Any id not found by the batch call (deleted spot, etc.) falls back to showing the id
          if (active) setBookings(list.map((b) => mapApiBooking(b, spotTitleMap[b.parking_spot_id] ?? b.parking_spot_id)));
        })
        .catch((err) => console.warn('[Bookings] fetch error:', err))
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.id, sort, status])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    optionsRow: { flexDirection: 'row', gap: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    total: { color: colors.teal, fontWeight: '700', marginTop: 4, fontSize: sc(15) },
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
    codeChipText: { color: colors.teal, fontWeight: '700', fontSize: sc(12) },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
  });

  const header = (
    <>
      <View style={styles.headerRow}>
        <Text style={typography.h1}>{t('driver.bookings.title')}</Text>
        <RoleBadge />
      </View>
      <View style={styles.optionsRow}>
        <DropdownSelect
          icon="swap-vertical"
          value={sort}
          onChange={setSort}
          options={(['recent', 'upcoming'] as const).map((option) => ({
            value: option,
            label: t(`driver.bookings.sort.${option}`),
          }))}
        />
        <DropdownSelect
          icon="filter"
          value={status ?? 'ALL'}
          onChange={(value) => setStatus(value === 'ALL' ? undefined : value)}
          active={!!status}
          options={[
            { value: 'ALL' as const, label: t('driver.bookings.filter.all') },
            ...FILTER_STATUSES.map((option) => ({ value: option, label: t(`receipt.statusValue.${option}`) })),
          ]}
        />
      </View>
    </>
  );

  if (loading) {
    return (
      <Screen style={styles.container}>
        {header}
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {header}
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={bookings.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={sc(40)} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t(status ? 'driver.bookings.filter.empty' : 'driver.bookings.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`${group}/bookings/${item.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={[typography.h2, { flex: 1 }]}>{item.parkingSpotTitle}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={typography.caption}>
                {formatBookingWhen(item, t('driver.booking.timeTo'))}
              </Text>
              <Text style={styles.total}>${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              {item.status === 'PENDING_PAYMENT' && <PaymentDueHint holdExpiresAt={item.holdExpiresAt} />}
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
