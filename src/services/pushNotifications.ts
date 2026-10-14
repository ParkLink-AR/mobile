import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { deleteDeviceToken, putDeviceToken, type DevicePlatform } from '@/src/api/notifications';
import { useAccountTypeStore, groupFor } from '@/src/store/useAccountTypeStore';
import { useSessionStore } from '@/src/store/useSessionStore';

const BRAND_COLOR = '#168B8D';

// Notifications about a booking. Both the ones we present in the foreground and
// the ones FCM shows on its own (backend sends channel_id="bookings") land
// here; HIGH importance makes them pop as a heads-up banner.
export const BOOKINGS_CHANNEL_ID = 'bookings';

// expo-notifications registers a global device-push-token listener the
// instant it's imported (see its DevicePushTokenAutoRegistration.fx module),
// and that listener throws on Android as soon as it fires if we're inside
// Expo Go -- remote push was removed from Expo Go in SDK 53. Checking
// isRunningInExpoGo() first (the exact check expo-notifications itself uses
// internally) avoids that entirely -- a development build (expo-dev-client)
// or any bare/standalone build on a simulator/emulator or device still gets
// the real thing. The try/catch is a second, broader safety net: on ANY
// simulator/emulator/build where this native module is missing or
// misconfigured for some unrelated reason, we still get `null` here instead
// of an uncaught crash -- every function below already no-ops on null.
type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  if (isRunningInExpoGo()) return null;
  try {
    return require('expo-notifications');
  } catch (err) {
    console.warn('[push] expo-notifications unavailable:', err);
    return null;
  }
}

const Notifications = loadNotifications();

/** Creates the Android notification channel. Safe to call repeatedly. No-op in Expo Go. */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync(BOOKINGS_CHANNEL_ID, {
      name: 'Reservas',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: BRAND_COLOR,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (err) {
    console.warn('[push] ensureNotificationChannel failed:', err);
  }
}

// By default expo-notifications suppresses notifications while the app is in
// the foreground. We want them shown as real system banners (same as when the
// app is backgrounded), so FCM messages that arrive with the app open look
// identical to the ones the OS shows on its own. No-op in Expo Go, and
// tolerates any other setup error instead of crashing at import time.
try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (err) {
  console.warn('[push] setNotificationHandler failed:', err);
}

/**
 * Presents an FCM message as a local system notification. Used for messages
 * that arrive while the app is in the foreground -- Android does not surface
 * those itself, so without this the user would see nothing. No-op in Expo Go
 * (which never receives FCM messages to present in the first place).
 */
export async function presentLocalNotification(
  title: string | undefined,
  body: string | undefined,
  route: string | null,
): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title ?? 'ParkLink',
        body: body ?? '',
        data: route ? { route } : {},
        color: BRAND_COLOR,
      },
      // On Android, a bare { channelId } trigger delivers immediately on that
      // channel (HIGH importance -> heads-up). iOS has no channels: null.
      trigger: Platform.OS === 'android' ? { channelId: BOOKINGS_CHANNEL_ID } : null,
    });
  } catch (err) {
    console.warn('[push] presentLocalNotification failed:', err);
  }
}

/**
 * Subscribes to taps on notifications presented by expo-notifications (the
 * foreground ones). Returns an unsubscribe function. No-op in Expo Go.
 */
export function subscribeLocalNotificationTaps(onRoute: (path: string) => void): () => void {
  if (!Notifications) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string' && route) onRoute(route);
    });
    return () => sub.remove();
  } catch (err) {
    console.warn('[push] subscribeLocalNotificationTaps failed:', err);
    return () => {};
  }
}

// @react-native-firebase/messaging v22+ is modular-only: there is no default
// `messaging()` export any more, just named functions that take the messaging
// instance. It's also only present in a real build (not jest, not Expo Go --
// requiring it there doesn't just fail cleanly, the native module registry
// throws an *uncaught* "Native module ... is not registered" error as a side
// effect of the require() call itself, before our try/catch below ever gets a
// chance to run. Skip the require entirely in Expo Go instead of relying on
// the catch to save us -- same reasoning as the expo-notifications guard above.
/* eslint-disable @typescript-eslint/no-explicit-any */
type RNFBMessaging = {
  mod: any; // the module namespace (getToken, requestPermission, AuthorizationStatus, …)
  instance: any; // getMessaging()
};

function loadMessaging(): RNFBMessaging | null {
  if (isRunningInExpoGo()) return null;
  try {
    const mod = require('@react-native-firebase/messaging');
    return { mod, instance: mod.getMessaging() };
  } catch {
    return null;
  }
}

// RNFirebase wants a background message handler registered outside the React
// tree (at module load). Every push we send carries a `notification` payload,
// so Android displays it itself while backgrounded and this handler has nothing
// to do -- it exists to satisfy the API (and silence the startup warning), and
// is where a data-only message would be handled if we ever send one.
(() => {
  const m = loadMessaging();
  if (!m) return;
  try {
    m.mod.setBackgroundMessageHandler(m.instance, async () => {});
  } catch {
    /* ignore */
  }
})();

const platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : 'android';

let registered = false;
let unsubscribeTokenRefresh: (() => void) | null = null;

/**
 * Asks for notification permission, gets the FCM token, and sends it to the
 * backend. Safe to call repeatedly (no-op once registered) and on every app
 * foreground. Silently does nothing outside a Firebase-enabled build.
 */
export async function registerForPush(): Promise<void> {
  if (registered) return;
  const m = loadMessaging();
  if (!m) return;
  const { mod, instance } = m;

  try {
    const status = await mod.requestPermission(instance);
    const granted =
      status === mod.AuthorizationStatus.AUTHORIZED ||
      status === mod.AuthorizationStatus.PROVISIONAL;
    if (!granted) return;

    if (Platform.OS === 'ios') {
      await mod.registerDeviceForRemoteMessages(instance);
    }

    const token: string = await mod.getToken(instance);
    await putDeviceToken(token, platform);
    registered = true;

    unsubscribeTokenRefresh?.();
    unsubscribeTokenRefresh = mod.onTokenRefresh(instance, (next: string) => {
      putDeviceToken(next, platform).catch((err) =>
        console.warn('[push] token refresh sync failed:', err),
      );
    });
  } catch (err) {
    console.warn('[push] registration failed:', err);
  }
}

/** Removes this device's token on logout. Best effort. */
export async function unregisterPush(): Promise<void> {
  registered = false;
  unsubscribeTokenRefresh?.();
  unsubscribeTokenRefresh = null;

  const m = loadMessaging();
  if (!m) return;
  const { mod, instance } = m;

  try {
    const token: string = await mod.getToken(instance);
    if (token) await deleteDeviceToken(token);
    await mod.deleteToken(instance);
  } catch {
    // ignore -- the token is cleaned up server-side on the next FCM receipt anyway
  }
}

/**
 * Maps a notification `data` payload to an in-app route, or null. Each case
 * checks for the key IT needs rather than one blanket `bookingId`-required
 * guard up front -- a settlement notification covers multiple bookings and
 * carries no single bookingId, so a shared guard would have silently
 * swallowed it before ever reaching the switch.
 */
// Which side a push is for, by type, for the ones whose data doesn't say so.
const TYPE_ROLE: Record<string, 'driver' | 'owner'> = {
  'booking.confirmed': 'driver',
  'booking.verified': 'driver',
  'booking.payment_received': 'driver',
  'booking.ending_soon': 'driver',
  'refund.completed': 'driver',
  'booking.pending_approval': 'owner',
  'booking.approval_reminder': 'owner',
  'settlement.drafted': 'owner',
  'settlement.paid': 'owner',
  'parking_spot.reviewed': 'owner',
};

function routeFor(data: Record<string, string> | undefined): string | null {
  // In the route group of the side the notification is for (the server sends it as `role`;
  // older pushes without it fall back by type) -- openInMode switches the app to that mode
  // before opening it. An announcement isn't for either side: it stays in the current one.
  const role = data?.role === 'owner' || data?.role === 'driver' ? data.role : data?.type ? TYPE_ROLE[data.type] : undefined;
  const group = groupFor(role ?? useAccountTypeStore.getState().activeMode);
  switch (data?.type) {
    // Sent to the driver when their booking is confirmed.
    case 'booking.confirmed':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=driver`;
    // Sent to the owner when a paid booking is waiting for them to accept/reject.
    case 'booking.pending_approval':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=owner`;
    // Sent to the side that didn't call the booking off: the driver when the owner rejected
    // it, never answered it, or closed their account; the owner when the driver cancelled.
    case 'booking.cancelled':
      if (!data.bookingId) return null;
      return role ? `${group}/bookings/${data.bookingId}?view=${role}` : `${group}/bookings/${data.bookingId}`;
    // Sent to both sides once the stay is over: each is asked to review the other.
    case 'booking.completed':
      if (!data.bookingId) return null;
      return `${group}/review/${data.bookingId}?role=${data.role === 'owner' ? 'owner' : 'driver'}`;
    // Sent to the driver once the owner enters their arrival code.
    case 'booking.verified':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=driver`;
    // Sent to whichever side of a booking did NOT send the message -- the thread itself
    // is the same for both sides.
    case 'booking.message_sent':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}/messages`;
    // Sent to whichever user opened the ticket (driver or owner).
    case 'support.ticket_replied':
      if (!data.bookingId || !data.ticketId) return null;
      return `${group}/bookings/${data.bookingId}/tickets/${data.ticketId}`;
    // Sent to the owner once an admin prepares a settlement of their payouts, and once its
    // transfer is confirmed. No bookingId: a settlement covers however many bookings were
    // batched.
    case 'settlement.drafted':
    case 'settlement.paid':
      if (!data.settlementId) return null;
      return `${group}/settlements/${data.settlementId}`;
    // Sent to the driver once their payment went through (the owner still has to accept).
    case 'booking.payment_received':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=driver`;
    // Sent to the owner before a booking request expires unanswered.
    case 'booking.approval_reminder':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=owner`;
    // An admin decided on a booking that ended without its arrival verified (owner: paid
    // or not; driver: refunded), and the before-start reminder -- both say which side.
    case 'booking.verification_reviewed':
    case 'booking.starting_soon':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=${data.role === 'owner' ? 'owner' : 'driver'}`;
    // Sent to the driver before a stay ends, and once a refund that had failed reaches them.
    case 'booking.ending_soon':
    case 'refund.completed':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=driver`;
    // Sent to whoever was reviewed: their own profile, where the review shows.
    case 'review.received': {
      const userId = useSessionStore.getState().user?.id;
      if (!userId) return null;
      return `${group}/profile/${userId}?as=${data.role === 'owner' ? 'owner' : 'driver'}`;
    }
    // Sent to whoever opened a support ticket, once staff close it.
    case 'support.ticket_closed':
      if (!data.bookingId || !data.ticketId) return null;
      return `${group}/bookings/${data.bookingId}/tickets/${data.ticketId}`;
    // Sent to both sides when ParkLink staff cancel a booking or refund one, and when the
    // driver extends one (it opens the extension).
    case 'booking.admin_action':
    case 'booking.extended':
      if (!data.bookingId) return null;
      return `${group}/bookings/${data.bookingId}?view=${data.role === 'owner' ? 'owner' : 'driver'}`;
    // An announcement from ParkLink: the inbox shows its whole text.
    case 'announcement':
      return `${group}/notifications`;
    // Sent to the owner once an admin approves, rejects, suspends or restores their spot.
    case 'parking_spot.reviewed':
      if (!data.parkingSpotId) return null;
      return `${group}/spots/${data.parkingSpotId}`;
    default:
      return null;
  }
}

/**
 * Route to open if the app was launched by tapping a notification (cold start).
 */
export async function getLaunchNotificationRoute(): Promise<string | null> {
  const m = loadMessaging();
  if (!m) return null;
  try {
    const message = await m.mod.getInitialNotification(m.instance);
    return routeFor(message?.data);
  } catch {
    return null;
  }
}

/**
 * Subscribes to notification taps while the app is backgrounded. Returns an
 * unsubscribe function.
 */
export function subscribeNotificationTaps(onRoute: (path: string) => void): () => void {
  const m = loadMessaging();
  if (!m) return () => {};
  try {
    return m.mod.onNotificationOpenedApp(m.instance, (message: { data?: Record<string, string> }) => {
      const path = routeFor(message?.data);
      if (path) onRoute(path);
    });
  } catch {
    return () => {};
  }
}

export type ForegroundNotification = {
  title?: string;
  body?: string;
  /** In-app route for this notification, or null if it doesn't map to one. */
  route: string | null;
};

/**
 * Subscribes to messages that arrive while the app is in the foreground. FCM
 * does NOT show these as system notifications, so the caller decides how to
 * surface them (e.g. an in-app alert). Returns an unsubscribe function.
 */
export function subscribeForegroundMessages(
  onMessage: (notification: ForegroundNotification) => void,
): () => void {
  const m = loadMessaging();
  if (!m) return () => {};
  try {
    return m.mod.onMessage(
      m.instance,
      (message: {
        notification?: { title?: string; body?: string };
        data?: Record<string, string>;
      }) => {
        onMessage({
          title: message?.notification?.title,
          body: message?.notification?.body,
          route: routeFor(message?.data),
        });
      },
    );
  } catch {
    return () => {};
  }
}
