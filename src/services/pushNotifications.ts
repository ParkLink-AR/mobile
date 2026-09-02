import { Platform } from 'react-native';
import { deleteDeviceToken, putDeviceToken, type DevicePlatform } from '@/src/api/notifications';

// @react-native-firebase/messaging only exists in a real development build
// (not Expo Go, not jest). Load it lazily and tolerate its absence so this
// module is safe to import anywhere. The namespaced messaging API has no
// bundled types worth threading through here.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Messaging = any;

function loadMessaging(): Messaging | null {
  try {
    return require('@react-native-firebase/messaging').default;
  } catch {
    return null;
  }
}

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
  const messaging = loadMessaging();
  if (!messaging) return;

  try {
    const status = await messaging().requestPermission();
    const granted =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!granted) return;

    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token: string = await messaging().getToken();
    await putDeviceToken(token, platform);
    registered = true;

    unsubscribeTokenRefresh?.();
    unsubscribeTokenRefresh = messaging().onTokenRefresh((next: string) => {
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

  const messaging = loadMessaging();
  if (!messaging) return;

  try {
    const token: string = await messaging().getToken();
    if (token) await deleteDeviceToken(token);
    await messaging().deleteToken();
  } catch {
    // ignore -- the token is cleaned up server-side on the next FCM receipt anyway
  }
}

/** Maps a notification `data` payload to an in-app route, or null. */
function routeFor(data: Record<string, string> | undefined): string | null {
  if (data?.type === 'booking.confirmed' && data.bookingId) {
    return `/(driver)/bookings/${data.bookingId}`;
  }
  return null;
}

/**
 * Route to open if the app was launched by tapping a notification (cold start).
 */
export async function getLaunchNotificationRoute(): Promise<string | null> {
  const messaging = loadMessaging();
  if (!messaging) return null;
  try {
    const message = await messaging().getInitialNotification();
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
  const messaging = loadMessaging();
  if (!messaging) return () => {};
  try {
    return messaging().onNotificationOpenedApp((message: { data?: Record<string, string> }) => {
      const path = routeFor(message?.data);
      if (path) onRoute(path);
    });
  } catch {
    return () => {};
  }
}
