import { View, Text, Pressable, StyleSheet } from 'react-native'; // Text kept for badge
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useUnseenNotificationsCount } from '@/src/store/useNotificationsStore';
import { t, useLanguage } from '@/src/i18n';
import { useSettingsStore } from '@/src/store/useSettingsStore';

const ICON_SCALE: Record<'small' | 'medium' | 'large', number> = {
  small: 1,
  medium: 1.15,
  large: 1.3,
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabKey {
  name: string;
  labelKey: string;
  icon: IoniconName;
  activeIcon: IoniconName;
  showBadge?: boolean;
}

const OWNER_TAB_KEYS: TabKey[] = [
  { name: 'calendar',      labelKey: 'tabs.owner.calendar',      icon: 'calendar-outline',      activeIcon: 'calendar' },
  { name: 'spots',         labelKey: 'tabs.owner.spots',         icon: 'car-outline',           activeIcon: 'car' },
  { name: 'notifications', labelKey: 'tabs.owner.notifications', icon: 'notifications-outline', activeIcon: 'notifications', showBadge: true },
  { name: 'profile',       labelKey: 'tabs.owner.profile',       icon: 'person-outline',        activeIcon: 'person' },
];

export function OwnerDockTabBar({ state, navigation }: BottomTabBarProps) {
  useLanguage();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const unseenCount = useUnseenNotificationsCount();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scale = ICON_SCALE[fontSize ?? 'large'];
  const iconSize = Math.round(28 * scale);
  const tabPaddingH = Math.round(20 * scale);
  const tabPaddingV = Math.round(8 * scale);

  const styles = StyleSheet.create({
    outer: {
      paddingBottom: Math.max(insets.bottom, 12),
      backgroundColor: 'transparent',
      pointerEvents: 'box-none',
    },
    pill: {
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 8,
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
      backgroundColor: colors.ownerAccent + '22',
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
        {OWNER_TAB_KEYS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const route = state.routes[routeIndex];
          const focused = state.index === routeIndex;
          const color = focused ? colors.ownerAccent : colors.textSecondary;

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
                {tab.showBadge && unseenCount > 0 && (
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
