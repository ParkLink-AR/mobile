import { t, useLanguage } from '@/src/i18n';
import { Tabs } from 'expo-router';
import { DriverDockTabBar } from '@/src/components/DockTabBar';

export default function DriverTabsLayout() {
  useLanguage();
  return (
    <Tabs
      tabBar={(props) => <DriverDockTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.driver.search') }} />
      <Tabs.Screen name="bookings" options={{ title: t('tabs.driver.bookings') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.driver.profile') }} />
    </Tabs>
  );
}
