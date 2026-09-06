import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useUnseenNotificationsCount } from '@/src/store/useNotificationsStore';
import { t, useLanguage } from '@/src/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabKey {
  name: string;
  labelKey: string;
  icon: IoniconName;
  activeIcon: IoniconName;
  showBadge?: boolean;
}

const OWNER_TAB_KEYS: TabKey[] = [
  { name: 'index',         labelKey: 'tabs.owner.home',          icon: 'home-outline',          activeIcon: 'home' },
  { name: 'spots',         labelKey: 'tabs.owner.spots',         icon: 'car-outline',           activeIcon: 'car' },
  { name: 'bookings',      labelKey: 'tabs.owner.bookings',      icon: 'calendar-outline',      activeIcon: 'calendar' },
  { name: 'notifications', labelKey: 'tabs.owner.notifications', icon: 'notifications-outline', activeIcon: 'notifications', showBadge: true },
  { name: 'profile',       labelKey: 'tabs.owner.profile',       icon: 'person-outline',        activeIcon: 'person' },
];

const BOTH_TAB_KEYS: TabKey[] = [
  { name: 'index',         labelKey: 'tabs.both.search',         icon: 'search-outline',        activeIcon: 'search' },
  { name: 'bookings',      labelKey: 'tabs.both.bookings',       icon: 'calendar-outline',      activeIcon: 'calendar' },
  { name: 'spots',         labelKey: 'tabs.both.spots',          icon: 'car-outline',           activeIcon: 'car' },
  { name: 'notifications', labelKey: 'tabs.both.notifications',  icon: 'notifications-outline', activeIcon: 'notifications', showBadge: true },
  { name: 'profile',       labelKey: 'tabs.both.profile',        icon: 'person-outline',        activeIcon: 'person' },
];

function TabBar({ state, navigation, tabs }: BottomTabBarProps & { tabs: TabKey[] }) {
  useLanguage();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const unseenCount = useUnseenNotificationsCount();

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
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    label: { fontSize: 11, fontWeight: '600' },
  });

  return (
    <View style={styles.bar}>
      {tabs.map((tab, index) => {
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
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={22} color={color} />
              {tab.showBadge && unseenCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]}>{t(tab.labelKey as any)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OwnerDockTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} tabs={OWNER_TAB_KEYS} />;
}

export function BothDockTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} tabs={BOTH_TAB_KEYS} />;
}
