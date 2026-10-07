import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import {
  ensureNotificationChannel,
  getLaunchNotificationRoute,
  presentLocalNotification,
  registerForPush,
  subscribeForegroundMessages,
  subscribeLocalNotificationTaps,
  subscribeNotificationTaps,
  unregisterPush,
} from '@/src/services/pushNotifications';
import { preloadPlateAssets } from '@/src/components/VehiclePlate';
import { onAccountBlocked, request } from '@/src/api/client';

// Required for expo-web-browser to intercept deep-link redirects from
// MercadoPago and close the in-app browser automatically.
WebBrowser.maybeCompleteAuthSession();

// How often a logged-in app checks its account is still usable, so a suspension (or a
// deletion) reaches an open app within a minute instead of whenever the access token
// happens to expire. Also checked every time the app comes back to the foreground.
const ACCOUNT_CHECK_INTERVAL_MS = 60 * 1000;

// Start loading the license-plate images and fonts right away, so plates render whole
// the first time a screen shows one (see VehiclePlate).
preloadPlateAssets();

export default function RootLayout() {
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const prevUserId = useRef<string | null>(null);
  const fetchCommissionRate = useCommissionStore((s) => s.fetchRate);

  // The platform commission rate for price-breakdown displays (create-spot preview,
  // spot details) -- fetched once per session, since it rarely changes and every screen
  // that needs it reads the same cached value from useCommissionStore.
  useEffect(() => {
    if (userId) fetchCommissionRate();
  }, [userId, fetchCommissionRate]);

  // Register the device's FCM token when a user is signed in; drop it on
  // logout. registerForPush() is a no-op outside a Firebase-enabled build.
  useEffect(() => {
    if (userId && userId !== prevUserId.current) {
      registerForPush();
    } else if (!userId && prevUserId.current) {
      unregisterPush();
    }
    prevUserId.current = userId;
  }, [userId]);

  // The account was suspended or is being deleted while logged in: back to the login,
  // which says why and clears the session once this session's screens are gone (they
  // assume a logged-in user). Only once per session, however many requests hit it.
  const loggingOut = useRef(false);
  useEffect(() => {
    if (userId) loggingOut.current = false;
  }, [userId]);
  useEffect(() => {
    onAccountBlocked((error) => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      router.replace({ pathname: '/(auth)/login', params: { accountNotice: error.detail } });
    });
    return () => onAccountBlocked(null);
  }, []);

  // Asks auth-service about the account every so often and on returning to the app --
  // a blocked account answers with its reason, which the listener above acts on.
  useEffect(() => {
    if (!userId) return;
    const check = () => {
      request(`/users/${userId}`).catch(() => {});
    };
    const interval = setInterval(check, ACCOUNT_CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [userId]);

  // Notification taps -> deep-link into the relevant screen. Covers taps on
  // OS-shown notifications (cold start + background, via react-native-firebase)
  // and taps on the ones we present ourselves in the foreground (via
  // expo-notifications).
  useEffect(() => {
    getLaunchNotificationRoute().then((path) => {
      if (path) router.push(path as never);
    });
    const unsubFcmTaps = subscribeNotificationTaps((path) => router.push(path as never));
    const unsubLocalTaps = subscribeLocalNotificationTaps((path) => router.push(path as never));
    return () => {
      unsubFcmTaps();
      unsubLocalTaps();
    };
  }, []);

  // Foreground messages: Android doesn't show these itself, so re-present each
  // one as a real system notification (styled with the ParkLink icon + brand
  // colour by the expo-notifications config plugin).
  useEffect(() => {
    ensureNotificationChannel();
    return subscribeForegroundMessages(({ title, body, route }) => {
      presentLocalNotification(title, body, route);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(owner)" />
      </Stack>
    </SafeAreaProvider>
  );
}
