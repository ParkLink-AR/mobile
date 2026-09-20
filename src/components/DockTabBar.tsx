import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useUnseenNotificationsCount } from '@/src/store/useNotificationsStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';

const ICON_SCALE: Record<'small' | 'medium' | 'large', number> = {
  small: 1,
  medium: 1.15,
  large: 1.3,
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_KEYS: { name: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'index',         icon: 'search-outline',        activeIcon: 'search' },
  { name: 'bookings',      icon: 'calendar-outline',       activeIcon: 'calendar' },
  { name: 'notifications', icon: 'notifications-outline',  activeIcon: 'notifications' },
  { name: 'profile',       icon: 'person-outline',         activeIcon: 'person' },
];

export function DockTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const unseenCount = useUnseenNotificationsCount();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scale = ICON_SCALE[fontSize ?? 'large'];
  const iconSize = Math.round(28 * scale);
  const tabPaddingH = Math.round(20 * scale);
  const tabPaddingV = Math.round(8 * scale);

  const styles = StyleSheet.create({
    // Outer container: just provides the safe-area bottom padding so the pill
    // doesn't sit on top of the home indicator.
    outer: {
      paddingBottom: Math.max(insets.bottom, 12),
      backgroundColor: 'transparent',
      // Prevent the transparent outer from blocking touches on the map below it
      pointerEvents: 'box-none',
    },
    // The floating pill itself
    pill: {
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 8,
      // Subtle shadow so it lifts off the content
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 10,
    },
    tab: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: tabPaddingH,
      paddingVertical: tabPaddingV,
      borderRadius: 24,
    },
    tabActive: {
      backgroundColor: colors.teal + '22', // teal at ~13% opacity
    },
    iconWrapper: { position: 'relative' },
    badge: {
      position: 'absolute', top: -5, right: -9,
      minWidth: 17, height: 17, borderRadius: 9,
      backgroundColor: '#FF3B30',
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  });

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.pill}>
        {TAB_KEYS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const route = state.routes[routeIndex];
          const focused = state.index === routeIndex;
          const color = focused ? colors.teal : colors.textSecondary;

          return (
            <Pressable
              key={tab.name}
              style={[styles.tab, focused && styles.tabActive]}
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
              android_ripple={{ borderless: true, radius: 36 }}
            >
              <View style={styles.iconWrapper}>
                <Ionicons name={focused ? tab.activeIcon : tab.icon} size={iconSize} color={color} />
                {tab.name === 'notifications' && unseenCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Keep named export for backwards compat with any remaining import
export { DockTabBar as DriverDockTabBar };
