import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { RoleIcon } from '@/src/components/RoleBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { isOpenRequest, useNotificationsStore } from '@/src/store/useNotificationsStore';
import { AppNotification, isRoleless, notificationRole } from '@/src/services/notificationsFeed';
import { formatBookingWhen, formatShortDateFromISO } from '@/src/services/bookingDates';
import { approveBookingApi, rejectBookingApi } from '@/src/api/booking';
import { useSessionStore } from '@/src/store/useSessionStore';
import { openInMode } from '@/src/services/openInMode';
import { formatDebtPesos } from '@/src/services/debts';
import { ApiError } from '@/src/api/client';

const ICONS: Record<AppNotification['kind'], keyof typeof Ionicons.glyphMap> = {
  owner_request: 'time-outline',
  driver_confirmed: 'checkmark-circle',
  driver_rejected: 'close-circle',
  driver_request_expired: 'hourglass-outline',
  driver_spot_unavailable: 'close-circle',
  owner_booking_cancelled: 'close-circle',
  driver_review_prompt: 'star-outline',
  owner_review_prompt: 'star-outline',
  driver_verified: 'shield-checkmark-outline',
  message_received: 'chatbubble-ellipses-outline',
  ticket_replied: 'help-buoy-outline',
  owner_settlement_paid: 'cash-outline',
  owner_spot_approved: 'checkmark-done-circle',
  owner_spot_rejected: 'alert-circle',
  driver_payment_received: 'card-outline',
  owner_request_expired: 'hourglass-outline',
  owner_request_reminder: 'alarm-outline',
  owner_payout_approved: 'cash-outline',
  owner_payout_denied: 'close-circle',
  driver_unverified_refunded: 'cash-outline',
  driver_starting_soon: 'car-outline',
  owner_starting_soon: 'car-outline',
  driver_stay_ending: 'time-outline',
  driver_hourly_ending: 'time-outline',
  driver_booking_ended: 'log-out-outline',
  driver_overstay_charged: 'wallet-outline',
  owner_overstay_paid: 'cash-outline',
  review_received: 'star',
  ticket_closed: 'checkmark-circle-outline',
  driver_refund_completed: 'cash-outline',
  owner_settlement_drafted: 'receipt-outline',
  driver_admin_cancelled: 'close-circle',
  owner_admin_cancelled: 'close-circle',
  driver_admin_refund: 'cash-outline',
  owner_admin_refund: 'cash-outline',
  owner_spot_suspended: 'pause-circle',
  owner_spot_restored: 'play-circle',
  announcement: 'megaphone-outline',
  driver_owner_cancelled: 'close-circle',
  driver_booking_extended: 'add-circle-outline',
  owner_booking_extended: 'add-circle-outline',
};

const DANGER = '#C62828';

/** "Ahora", "Hace 5 min", "Hace 3 h", "Ayer", or the date. */
function formatAgo(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);
  if (minutes < 1) return t('notifications.time.now');
  if (minutes < 60) return t('notifications.time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.time.hours', { n: hours });
  if (hours < 48) return t('notifications.time.yesterday');
  return formatShortDateFromISO(iso);
}

export default function Notifications() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const loadingMore = useNotificationsStore((s) => s.loadingMore);
  const hasLoadedOnce = useNotificationsStore((s) => s.hasLoadedOnce);
  const answeredBookingIds = useNotificationsStore((s) => s.answeredBookingIds);
  const refresh = useNotificationsStore((s) => s.refresh);
  const loadMore = useNotificationsStore((s) => s.loadMore);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const markAnswered = useNotificationsStore((s) => s.markAnswered);
  const startVisit = useNotificationsStore((s) => s.startVisit);
  const freshIds = useNotificationsStore((s) => s.freshIds);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Tabs stay mounted in the background, so notifications only count as read while this
  // tab is actually on screen.
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      startVisit();
      refresh();
      return () => setFocused(false);
    }, [refresh, startVisit]),
  );

  // Whatever is unread while the tab is on screen (what was there on arrival, and anything
  // the live socket brings in meanwhile) is shown as new and marked read.
  useEffect(() => {
    if (focused && items.some((item) => !item.readAt)) markAllRead();
  }, [items, focused, markAllRead]);

  async function answer(bookingId: string, approve: boolean) {
    setBusyId(bookingId);
    try {
      await (approve ? approveBookingApi(bookingId) : rejectBookingApi(bookingId));
      markAnswered(bookingId);
      refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t(approve ? 'owner.spot.requests.errorApprove' : 'owner.spot.requests.errorReject'));
    } finally {
      setBusyId(null);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    freshCard: { borderColor: `${colors.teal}66`, backgroundColor: `${colors.teal}0D` },
    row: { flexDirection: 'row', gap: sc(10), alignItems: 'flex-start' },
    iconBadge: {
      width: sc(34), height: sc(34), borderRadius: sc(17), alignItems: 'center', justifyContent: 'center',
    },
    textBlock: { flex: 1, gap: sc(2) },
    itemTitle: { fontSize: sc(14.5), fontWeight: '700', color: colors.text },
    itemBody: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    itemTime: { fontSize: sc(12), color: colors.textSecondary, marginTop: sc(2) },
    side: { alignItems: 'center', gap: sc(8) },
    freshDot: { width: sc(9), height: sc(9), borderRadius: sc(5), backgroundColor: colors.teal },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sc(6),
      paddingVertical: 9, borderRadius: 10,
    },
    approveBtn: { backgroundColor: colors.teal },
    rejectBtn: { borderWidth: 1.5, borderColor: DANGER },
    approveBtnText: { color: colors.white, fontWeight: '700', fontSize: sc(14) },
    rejectBtnText: { color: DANGER, fontWeight: '700', fontSize: sc(14) },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    footer: { paddingVertical: 16 },
  });

  function iconColorFor(kind: AppNotification['kind']) {
    if (
      kind === 'owner_settlement_paid' ||
      kind === 'driver_payment_received' ||
      kind === 'owner_payout_approved' ||
      kind === 'driver_unverified_refunded' ||
      kind === 'driver_refund_completed' ||
      kind === 'driver_admin_refund'
    ) {
      return colors.success;
    }
    if (
      kind === 'driver_rejected' ||
      kind === 'driver_request_expired' ||
      kind === 'driver_spot_unavailable' ||
      kind === 'owner_booking_cancelled' ||
      kind === 'owner_spot_rejected' ||
      kind === 'owner_request_expired' ||
      kind === 'owner_payout_denied' ||
      kind === 'driver_admin_cancelled' ||
      kind === 'owner_admin_cancelled' ||
      kind === 'owner_admin_refund' ||
      kind === 'owner_spot_suspended' ||
      kind === 'driver_owner_cancelled'
    ) {
      return DANGER;
    }
    // The ones whose icon is a tick: the app's checkmarks are all teal.
    if (
      kind === 'driver_confirmed' ||
      kind === 'driver_verified' ||
      kind === 'owner_spot_approved' ||
      kind === 'message_received' ||
      kind === 'ticket_replied' ||
      kind === 'ticket_closed' ||
      kind === 'review_received' ||
      kind === 'driver_starting_soon' ||
      kind === 'owner_starting_soon' ||
      kind === 'owner_settlement_drafted' ||
      kind === 'owner_spot_restored' ||
      kind === 'announcement' ||
      kind === 'driver_booking_extended' ||
      kind === 'owner_booking_extended'
    ) {
      return colors.teal;
    }
    return colors.warning;
  }

  // The notification's bold first line: the spot (or the ticket's subject) -- or, for the
  // ones not about a single spot, a fixed title.
  function titleFor(item: AppNotification): string {
    switch (item.kind) {
      case 'owner_settlement_paid':
        return t('notifications.settlementPaid.title');
      case 'owner_settlement_drafted':
        return t('notifications.settlementDrafted.title');
      case 'driver_refund_completed':
        return t('notifications.refundCompleted.title');
      case 'review_received':
        return item.spotTitle || t('notifications.reviewReceived.title');
      case 'announcement':
        return item.spotTitle || t('notifications.announcement.title');
      default:
        return item.spotTitle;
    }
  }

  function bodyFor(item: AppNotification): string {
    const when = formatBookingWhen(item, t('driver.booking.timeTo'));
    switch (item.kind) {
      case 'owner_request':
        return isOpenRequest(item, answeredBookingIds)
          ? t('notifications.ownerRequest.body', { when })
          : `${t('notifications.ownerRequest.body', { when })} · ${t('notifications.ownerRequest.resolved')}`;
      case 'driver_confirmed':
        return t('notifications.driverConfirmed.body', { when });
      case 'driver_rejected':
        return t('notifications.driverRejected.body');
      case 'driver_request_expired':
        return t('notifications.driverRequestExpired.body', { when });
      case 'driver_spot_unavailable':
        return t('notifications.driverSpotUnavailable.body');
      case 'owner_booking_cancelled':
        return item.lateCancellation
          ? t('notifications.ownerBookingCancelled.bodyLate', { when })
          : t('notifications.ownerBookingCancelled.body', { when });
      case 'driver_review_prompt':
        return t('notifications.driverReviewPrompt.body');
      case 'owner_review_prompt':
        return item.counterpartName
          ? t('notifications.ownerReviewPrompt.bodyNamed', { name: item.counterpartName })
          : t('notifications.ownerReviewPrompt.body');
      case 'driver_verified':
        return t('notifications.driverVerified.body');
      case 'message_received':
        return item.preview ? `“${item.preview}”` : t('notifications.messageReceived.body', { spot: item.spotTitle });
      case 'ticket_replied':
        return item.preview ? `“${item.preview}”` : t('notifications.ticketReplied.body');
      case 'owner_settlement_paid':
        return t('notifications.settlementPaid.body', { amount: item.total.toLocaleString('es-AR') });
      case 'owner_spot_approved':
        return t('notifications.spotApproved.body');
      case 'owner_spot_rejected':
        return item.preview
          ? t('notifications.spotRejected.bodyWithReason', { reason: item.preview })
          : t('notifications.spotRejected.body');
      case 'driver_payment_received':
        return t('notifications.paymentReceived.body', { when });
      case 'owner_request_expired':
        return t('notifications.ownerRequestExpired.body', { when });
      case 'owner_request_reminder':
        return t('notifications.ownerRequestReminder.body', { when });
      case 'owner_payout_approved':
        return t('notifications.payoutApproved.body', { when });
      case 'owner_payout_denied':
        return t('notifications.payoutDenied.body', { when });
      case 'driver_unverified_refunded':
        return t('notifications.unverifiedRefunded.body', { when });
      case 'driver_starting_soon':
        return t('notifications.driverStartingSoon.body', { time: item.startTime });
      case 'owner_starting_soon':
        return t('notifications.ownerStartingSoon.body', { time: item.startTime });
      case 'driver_stay_ending':
        return t('notifications.stayEnding.body', { time: item.endTime });
      case 'driver_hourly_ending':
        return t('notifications.hourlyEnding.body', { time: item.endTime });
      case 'driver_booking_ended':
        return t('notifications.bookingEnded.body');
      case 'driver_overstay_charged':
        return t('notifications.overstayCharged.body', {
          minutes: String(item.overstayMinutes ?? 0), amount: formatDebtPesos(item.overstayAmount ?? 0),
        });
      case 'owner_overstay_paid':
        return t('notifications.overstayPaid.body', {
          minutes: String(item.overstayMinutes ?? 0), amount: formatDebtPesos(item.overstayAmount ?? 0),
        });
      case 'review_received':
        return t('notifications.reviewReceived.body', { stars: '★'.repeat(Math.max(0, Math.min(item.rating ?? 0, 5))) });
      case 'ticket_closed':
        return t('notifications.ticketClosed.body');
      case 'driver_refund_completed':
        return t('notifications.refundCompleted.body', { amount: item.total.toLocaleString('es-AR') });
      case 'owner_settlement_drafted':
        return t('notifications.settlementDrafted.body', { amount: item.total.toLocaleString('es-AR') });
      case 'driver_admin_cancelled':
        return item.total > 0
          ? t('notifications.adminCancelled.driverBodyRefund', { when, amount: item.total.toLocaleString('es-AR') })
          : t('notifications.adminCancelled.driverBody', { when });
      case 'owner_admin_cancelled':
        return t('notifications.adminCancelled.ownerBody', { when });
      case 'driver_admin_refund':
        return t('notifications.adminRefund.driverBody', { amount: item.total.toLocaleString('es-AR') });
      case 'owner_admin_refund':
        return t('notifications.adminRefund.ownerBody', { amount: item.total.toLocaleString('es-AR') });
      case 'owner_spot_suspended':
        return item.preview
          ? t('notifications.spotSuspended.bodyWithReason', { reason: item.preview })
          : t('notifications.spotSuspended.body');
      case 'owner_spot_restored':
        return t('notifications.spotRestored.body');
      case 'announcement':
        return item.preview ?? '';
      case 'driver_owner_cancelled':
        return item.preview
          ? t('notifications.ownerCancelled.bodyWithReason', { when, reason: item.preview })
          : t('notifications.ownerCancelled.body', { when });
      case 'driver_booking_extended':
        return t('notifications.bookingExtended.driverBody', { time: item.endTime });
      case 'owner_booking_extended':
        return t('notifications.bookingExtended.ownerBody', { time: item.endTime });
    }
  }

  // Every notification belongs to one side (owner or driver), and tapping it opens it in
  // that mode: an owner notification tapped in driver mode switches the app to owner mode
  // first (see openInMode). An announcement isn't about either side and opens nothing.
  const currentGroup = `/${useSegments()[0]}`;
  const userId = useSessionStore((s) => s.user?.id);
  function handlePress(item: AppNotification) {
    const role = notificationRole(item);
    const group = isRoleless(item.kind) ? currentGroup : `/(${role})`;
    switch (item.kind) {
      case 'owner_request':
        if (isOpenRequest(item, answeredBookingIds) && item.parkingSpotId) {
          openInMode(`${group}/spots/${item.parkingSpotId}/requests`);
        } else {
          openInMode(`${group}/bookings/${item.bookingId}?view=owner`);
        }
        break;
      case 'driver_review_prompt':
        openInMode(`${group}/review/${item.bookingId}?role=driver`);
        break;
      case 'owner_review_prompt':
        openInMode(`${group}/review/${item.bookingId}?role=owner`);
        break;
      case 'message_received':
        openInMode(`${group}/bookings/${item.bookingId}/messages`);
        break;
      case 'ticket_replied':
        if (item.ticketId) openInMode(`${group}/bookings/${item.bookingId}/tickets/${item.ticketId}`);
        break;
      case 'owner_settlement_paid':
      case 'owner_settlement_drafted':
        if (item.settlementId) openInMode(`${group}/settlements/${item.settlementId}`);
        break;
      case 'owner_request_reminder':
        // Still waiting: straight to where it can be answered.
        if (item.parkingSpotId) openInMode(`${group}/spots/${item.parkingSpotId}/requests`);
        else openInMode(`${group}/bookings/${item.bookingId}?view=owner`);
        break;
      case 'review_received':
        // Their own profile, as the side that was reviewed -- where the review shows.
        if (userId) openInMode(`${group}/profile/${userId}?as=${role}`);
        break;
      case 'ticket_closed':
        if (item.ticketId) openInMode(`${group}/bookings/${item.bookingId}/tickets/${item.ticketId}`);
        break;
      case 'driver_overstay_charged':
        // What they owe, itemised: the balance and the booking it comes from.
        openInMode(`${group}/debts`);
        break;
      case 'announcement':
        // Its whole text is already on screen; nothing to open.
        break;
      case 'owner_spot_approved':
      case 'owner_spot_rejected':
      case 'owner_spot_suspended':
      case 'owner_spot_restored':
        // The owner's own spot page: published, or what to fix before sending it again.
        if (item.parkingSpotId) openInMode(`${group}/spots/${item.parkingSpotId}`);
        break;
      default:
        // driver_confirmed, driver_rejected, driver_request_expired, driver_spot_unavailable,
        // owner_booking_cancelled, driver_verified, the *_admin_* ones
        openInMode(`${group}/bookings/${item.bookingId}?view=${role}`);
    }
  }

  if (loading && !hasLoadedOnce) {
    return (
      <Screen style={styles.container}>
        <Text style={typography.h1}>{t('tabs.driver.notifications')}</Text>
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('tabs.driver.notifications')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
        refreshing={loading && hasLoadedOnce}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.teal} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={sc(40)} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fresh = !item.readAt || freshIds.includes(item.id);
          return (
            <Card style={fresh ? styles.freshCard : undefined}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => handlePress(item)}
                accessibilityLabel={fresh ? t('notifications.new') : undefined}
              >
                <View style={[styles.iconBadge, { backgroundColor: iconColorFor(item.kind) + '20' }]}>
                  <Ionicons name={ICONS[item.kind]} size={sc(18)} color={iconColorFor(item.kind)} />
                </View>
                <View style={styles.textBlock}>
                  <Text style={styles.itemTitle}>
                    {titleFor(item)}
                  </Text>
                  <Text style={styles.itemBody}>{bodyFor(item)}</Text>
                  <Text style={styles.itemTime}>{formatAgo(item.at)}</Text>
                </View>
                <View style={styles.side}>
                  {isRoleless(item.kind) ? null : <RoleIcon role={notificationRole(item)} />}
                  {fresh && <View style={styles.freshDot} />}
                </View>
              </TouchableOpacity>

              {isOpenRequest(item, answeredBookingIds) && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => answer(item.bookingId, false)}
                    disabled={busyId === item.bookingId}
                  >
                    {busyId === item.bookingId ? (
                      <ActivityIndicator color={DANGER} size="small" />
                    ) : (
                      <>
                        <Ionicons name="close" size={sc(16)} color={DANGER} />
                        <Text style={styles.rejectBtnText}>{t('owner.spot.requests.reject')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => answer(item.bookingId, true)}
                    disabled={busyId === item.bookingId}
                  >
                    {busyId === item.bookingId ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={sc(16)} color={colors.white} />
                        <Text style={styles.approveBtnText}>{t('owner.spot.requests.approve')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
