import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { deleteDeviceToken, putDeviceToken, type DevicePlatform } from '@/src/api/notifications';

const BRAND_COLOR = '#168B8D';

// Notifications about a booking. Both the ones we present in the foreground and
// the ones FCM shows on its own (backend sends channel_id="bookings") land
// here; HIGH importance makes them pop as a heads-up banner.
export const BOOKINGS_CHANNEL_ID = 'bookings';

/** Creates the Android notification channel. Safe to call repeatedly. */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
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
// identical to the ones the OS shows on its own.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Presents an FCM message as a local system notification. Used for messages
 * that arrive while the app is in the foreground -- Android does not surface
 * those itself, so without this the user would see nothing.
 */
export async function presentLocalNotification(
  title: string | undefined,
  body: string | undefined,
  route: string | null,
): Promise<void> {
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
 * foreground ones). Returns an unsubscribe function.
 */
export function subscribeLocalNotificationTaps(onRoute: (path: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = response.notification.request.content.data?.route;
    if (typeof route === 'string' && route) onRoute(route);
  });
  return () => sub.remove();
}

// @react-native-firebase/messaging v22+ is modular-only: there is no default
// `messaging()` export any more, just named functions that take the messaging
// instance. It's also only present in a real build (not jest). Load it lazily
// and tolerate its absence so this module stays safe to import anywhere.
/* eslint-disable @typescript-eslint/no-explicit-any */
type RNFBMessaging = {
  mod: any; // the module namespace (getToken, requestPermission, AuthorizationStatus, …)
  instance: any; // getMessaging()
};

function loadMessaging(): RNFBMessaging | null {
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

/** Maps a notification `data` payload to an in-app route, or null. */
function routeFor(data: Record<string, string> | undefined): string | null {
  if (!data?.bookingId) return null;
  switch (data.type) {
    // Sent to the driver when their booking is confirmed.
    case 'booking.confirmed':
      return `/(driver)/bookings/${data.bookingId}`;
    // Sent to the owner when a paid booking is waiting for them to accept/reject.
    case 'booking.pending_approval':
      return `/(owner)/bookings/${data.bookingId}`;
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
