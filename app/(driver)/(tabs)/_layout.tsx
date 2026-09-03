import { useEffect } from 'react';
import { t, useLanguage } from '@/src/i18n';
import { Tabs } from 'expo-router';
import { DockTabBar } from '@/src/components/DockTabBar';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';

export default function TabsLayout() {
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const clearFavorites = useFavoritesStore((s) => s.clear);

  useEffect(() => {
    if (user) hydrateFavorites();
    else clearFavorites();
  }, [user?.id]);

  return (
    <Tabs
      tabBar={(props) => <DockTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.driver.search') }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.driver.favorites') }} />
      <Tabs.Screen name="bookings" options={{ title: t('tabs.driver.bookings') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.driver.profile') }} />
    </Tabs>
  );
}
