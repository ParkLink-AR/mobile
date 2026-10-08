import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useUnreadNotificationsCount } from '@/src/store/useNotificationsStore';
import { t, useLanguage } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_KEYS: { name: string; labelKey: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'index',         labelKey: 'tabs.driver.search',        icon: 'search-outline',       activeIcon: 'search' },
  { name: 'favorites',     labelKey: 'tabs.driver.favorites',     icon: 'heart-outline',         activeIcon: 'heart' },
  { name: 'bookings',      labelKey: 'tabs.driver.bookings',      icon: 'calendar-outline',      activeIcon: 'calendar' },
  { name: 'notifications', labelKey: 'tabs.driver.notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
  { name: 'profile',       labelKey: 'tabs.driver.profile',       icon: 'person-outline',        activeIcon: 'person' },
];

// Flat, docked bar (icon+label, only the active tab's color changes) --
// same structural layout as Airbnb's bottom nav, unlike the floating
// blurred pill this replaced.
export function DockTabBar({ state, navigation }: BottomTabBarProps) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const insets = useSafeAreaInsets();
  // With large text the labels no longer fit under the icons: icons only (each tab
  // still has its name as accessibility label).
  const showLabels = useSettingsStore((s) => s.fontSize) !== 'large';
  const unseenCount = useUnreadNotificationsCount();

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
    iconWrapper: { position: 'relative' },
    badge: {
      position: 'absolute', top: -4, right: -8,
      minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: '#FF3B30',
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: sc(10), fontWeight: '700' },
    // Tamaño fijo, sin cortar con "…". Con "Texto: Grande" las etiquetas se ocultan
    // (showLabels); el ícono sí escala.
    label: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.bar}>
      {TAB_KEYS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const route = state.routes[routeIndex];
        const focused = state.index === routeIndex;
        const color = focused ? colors.teal : colors.textSecondary;

        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={t(tab.labelKey)}
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
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={sc(22)} color={color} />
              {tab.name === 'notifications' && unseenCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
                </View>
              )}
            </View>
            {showLabels ? <Text style={[styles.label, { color }]}>{t(tab.labelKey)}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Keep named export for backwards compat with any remaining import
export { DockTabBar as DriverDockTabBar };
