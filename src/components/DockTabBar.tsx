import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { t, useLanguage } from '@/src/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_KEYS: { name: string; labelKey: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'index',     labelKey: 'tabs.driver.search',    icon: 'search-outline',   activeIcon: 'search' },
  { name: 'favorites', labelKey: 'tabs.driver.favorites', icon: 'heart-outline',    activeIcon: 'heart' },
  { name: 'bookings',  labelKey: 'tabs.driver.bookings',  icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'profile',   labelKey: 'tabs.driver.profile',   icon: 'person-outline',   activeIcon: 'person' },
];

// Flat, docked bar (icon+label, only the active tab's color changes) --
// same structural layout as Airbnb's bottom nav, unlike the floating
// blurred pill this replaced.
export function DockTabBar({ state, navigation }: BottomTabBarProps) {
  useLanguage();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 8),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.bar}>
      {TAB_KEYS.map((tab, index) => {
        const route = state.routes[index];
        const focused = state.index === index;
        const color = focused ? colors.teal : colors.textSecondary;

        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route?.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
            android_ripple={{ borderless: true, radius: 32 }}
          >
            <Ionicons name={focused ? tab.activeIcon : tab.icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{t(tab.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Keep named export for backwards compat with any remaining import
export { DockTabBar as DriverDockTabBar };
