import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useSessionStore } from '@/src/store/useSessionStore';
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

// Required for expo-web-browser to intercept deep-link redirects from
// MercadoPago and close the in-app browser automatically.
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const prevUserId = useRef<string | null>(null);

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
