import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';
import { AppNotification } from '@/src/services/notificationsFeed';
import { formatBookingWhen } from '@/src/services/bookingDates';
import { approveBookingApi, rejectBookingApi } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';

const ICONS: Record<AppNotification['kind'], keyof typeof Ionicons.glyphMap> = {
  owner_request: 'time-outline',
  owner_new_booking: 'checkmark-circle',
  driver_confirmed: 'checkmark-circle',
  driver_rejected: 'close-circle',
  driver_review_prompt: 'star-outline',
  owner_review_prompt: 'star-outline',
};

export default function Notifications() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const refresh = useNotificationsStore((s) => s.refresh);
  const markSeen = useNotificationsStore((s) => s.markSeen);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) refresh(user.id);
    }, [user?.id, refresh]),
  );

  useEffect(() => {
    if (items.length > 0) markSeen(items.map((item) => item.id));
  }, [items]);

  async function handleApprove(bookingId: string) {
    setBusyId(bookingId);
    try {
      await approveBookingApi(bookingId);
      if (user) refresh(user.id);
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
      if (user) refresh(user.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorReject'));
    } finally {
      setBusyId(null);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    iconBadge: {
      width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    },
    textBlock: { flex: 1, gap: 2 },
    itemTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
    itemBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
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

  function iconColorFor(kind: AppNotification['kind']) {
    if (kind === 'driver_confirmed' || kind === 'owner_new_booking') return colors.success;
    if (kind === 'driver_rejected') return '#C62828';
    return colors.warning;
  }

  function handlePress(item: AppNotification) {
    if (item.kind === 'owner_request') {
      router.push(`${group}/spot/${item.parkingSpotId}`);
    } else if (item.kind === 'driver_review_prompt') {
      router.push(`${group}/review/${item.bookingId}?role=driver`);
    } else if (item.kind === 'owner_review_prompt') {
      router.push(`${group}/review/${item.bookingId}?role=owner`);
    }
  }

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('tabs.driver.notifications')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, flexGrow: 1 }}
        refreshing={loading}
        onRefresh={() => user && refresh(user.id)}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <TouchableOpacity
              style={styles.row}
              onPress={() => handlePress(item)}
              disabled={item.kind === 'driver_confirmed' || item.kind === 'driver_rejected' || item.kind === 'owner_new_booking'}
            >
              <View style={[styles.iconBadge, { backgroundColor: iconColorFor(item.kind) + '20' }]}>
                <Ionicons name={ICONS[item.kind]} size={18} color={iconColorFor(item.kind)} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.itemTitle}>{item.spotTitle}</Text>
                <Text style={styles.itemBody}>
                  {item.kind === 'owner_request' && t('notifications.ownerRequest.body', { when: formatBookingWhen(item, t('driver.booking.timeTo')) })}
                  {item.kind === 'owner_new_booking' && t('notifications.ownerNewBooking.body', { when: formatBookingWhen(item, t('driver.booking.timeTo')) })}
                  {item.kind === 'driver_confirmed' && t('notifications.driverConfirmed.body', { when: formatBookingWhen(item, t('driver.booking.timeTo')) })}
                  {item.kind === 'driver_rejected' && t('notifications.driverRejected.body')}
                  {item.kind === 'driver_review_prompt' && t('notifications.driverReviewPrompt.body')}
                  {item.kind === 'owner_review_prompt' && t('notifications.ownerReviewPrompt.body')}
                </Text>
              </View>
            </TouchableOpacity>

            {item.kind === 'owner_request' && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(item.bookingId)}
                  disabled={busyId === item.bookingId}
                >
                  {busyId === item.bookingId ? (
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
                  onPress={() => handleApprove(item.bookingId)}
                  disabled={busyId === item.bookingId}
                >
                  {busyId === item.bookingId ? (
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
