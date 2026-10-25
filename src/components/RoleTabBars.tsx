import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { usePendingRequestsCount, useUnreadNotificationsCount } from '@/src/store/useNotificationsStore';
import { t, useLanguage } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabKey {
  name: string;
  labelKey: string;
  icon: IoniconName;
  activeIcon: IoniconName;
  // Which count the tab shows as a badge: unseen notifications, or booking requests still
  // waiting for the owner's answer.
  badge?: 'notifications' | 'requests';
}

const OWNER_TAB_KEYS: TabKey[] = [
  { name: 'index',         labelKey: 'tabs.owner.today',         icon: 'today-outline',         activeIcon: 'today', badge: 'requests' },
  { name: 'calendar',      labelKey: 'tabs.owner.calendar',      icon: 'calendar-outline',      activeIcon: 'calendar' },
  { name: 'spots',         labelKey: 'tabs.owner.spots',         icon: 'car-outline',           activeIcon: 'car' },
  { name: 'notifications', labelKey: 'tabs.owner.notifications', icon: 'notifications-outline', activeIcon: 'notifications', badge: 'notifications' },
  { name: 'profile',       labelKey: 'tabs.owner.profile',       icon: 'person-outline',        activeIcon: 'person' },
];

function TabBar({ state, emitter, navigateToTab, tabs }: BottomTabBarProps & { tabs: TabKey[] }) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const insets = useSafeAreaInsets();
  // With large text the labels no longer fit under the icons: icons only (each tab
  // still has its name as accessibility label).
  const showLabels = useSettingsStore((s) => s.fontSize) !== 'large';
  const unseenCount = useUnreadNotificationsCount();
  // Booking requests in the inbox still waiting for the owner's answer.
  const pendingRequestsCount = usePendingRequestsCount();

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
    // Tamaño fijo, sin cortar con "…" ("Notificaciones" entra justo en 11). Con
    // "Texto: Grande" las etiquetas se ocultan (showLabels); lo que sí escala es el ícono.
    label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  });

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const route = state.routes[routeIndex];
        const focused = state.index === routeIndex;
        const color = focused ? colors.teal : colors.textSecondary;

        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={t(tab.labelKey as any)}
            style={styles.tab}
            onPress={() => {
              // Same as expo-router's own tab bar: tell the screen, then switch by route key.
              if (!route) return;
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            }}
            android_ripple={{ borderless: true, radius: 32 }}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={sc(22)} color={color} />
              {(() => {
                const count = tab.badge === 'notifications' ? unseenCount : tab.badge === 'requests' ? pendingRequestsCount : 0;
                return count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                ) : null;
              })()}
            </View>
            {showLabels ? <Text style={[styles.label, { color }]}>{t(tab.labelKey as any)}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function OwnerDockTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} tabs={OWNER_TAB_KEYS} />;
}
