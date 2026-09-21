import { useEffect } from 'react';
import { t, useLanguage } from '@/src/i18n';
import { Tabs } from 'expo-router';
import { OwnerDockTabBar } from '@/src/components/RoleTabBars';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';

const NOTIFICATIONS_POLL_MS = 30_000;

export default function OwnerTabsLayout() {
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const refreshNotifications = useNotificationsStore((s) => s.refresh);
  const clearNotifications = useNotificationsStore((s) => s.clear);

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
      tabBar={(props) => <OwnerDockTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.owner.today') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.owner.calendar') }} />
      <Tabs.Screen name="spots" options={{ title: t('tabs.owner.spots') }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabs.owner.notifications') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.owner.profile') }} />
    </Tabs>
  );
}
