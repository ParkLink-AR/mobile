import { t, useLanguage } from '@/src/i18n';
import { Tabs } from 'expo-router';
import { OwnerDockTabBar } from '@/src/components/RoleTabBars';

// The notifications and requests badges are kept live by useNotificationsSync (root
// layout), not here.
export default function OwnerTabsLayout() {
  useLanguage();

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
