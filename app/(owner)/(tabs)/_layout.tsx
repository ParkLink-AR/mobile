import { Tabs } from 'expo-router';
import { useThemeColors } from '@/src/theme/useThemeColors';

export default function OwnerTabsLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="spots" options={{ title: 'Mis cocheras' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
