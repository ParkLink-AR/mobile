import { useEffect } from 'react';
import { t, useLanguage } from '@/src/i18n';
import { Tabs } from 'expo-router';
import { DockTabBar } from '@/src/components/DockTabBar';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';

// How often the notifications badge refreshes while any tab is open. There's
// no push infrastructure behind this (see notificationsFeed.ts) -- it's a
// plain poll, frequent enough to feel live without hammering the backend.
const NOTIFICATIONS_POLL_MS = 30_000;

export default function TabsLayout() {
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const clearFavorites = useFavoritesStore((s) => s.clear);
  const refreshNotifications = useNotificationsStore((s) => s.refresh);
  const clearNotifications = useNotificationsStore((s) => s.clear);

  useEffect(() => {
    if (user) hydrateFavorites();
    else clearFavorites();
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      clearNotifications();
      return;
    }
    refreshNotifications(user.id);
    const interval = setInterval(() => refreshNotifications(user.id), NOTIFICATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <Tabs
      tabBar={(props) => <DockTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.driver.search') }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="bookings" options={{ title: t('tabs.driver.bookings') }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabs.driver.notifications') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.driver.profile') }} />
    </Tabs>
  );
}
