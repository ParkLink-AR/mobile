import { t, useLanguage } from '@/src/i18n';
import { Tabs } from 'expo-router';
import { useThemeColors } from '@/src/theme/useThemeColors';

export default function DriverTabsLayout() {
  const colors = useThemeColors();
  useLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.driver.search') }} />
      <Tabs.Screen name="bookings" options={{ title: t('tabs.driver.bookings') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.driver.profile') }} />
    </Tabs>
  );
}
