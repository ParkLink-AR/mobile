import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { t, useLanguage } from '@/src/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_KEYS: { name: string; labelKey: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'index',    labelKey: 'tabs.driver.search',   icon: 'search-outline',   activeIcon: 'search' },
  { name: 'bookings', labelKey: 'tabs.driver.bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'profile',  labelKey: 'tabs.driver.profile',  icon: 'person-outline',   activeIcon: 'person' },
];

export function DockTabBar({ state, navigation }: BottomTabBarProps) {
  useLanguage();
  const colors = useThemeColors();
  const mode = useSettingsStore((s) => s.mode);
  const insets = useSafeAreaInsets();

  const bgColor = mode === 'dark' ? 'rgba(22,139,141,0.92)' : 'rgba(22,139,141,0.95)';

  return (
    <View
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
    >
      <View style={styles.blur}>
        <BlurView intensity={30} tint={mode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
        <View style={styles.inner}>
          {TAB_KEYS.map((tab, index) => {
            const route = state.routes[index];
            const focused = state.index === index;

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
                android_ripple={{ borderless: true, radius: 32 }}
              >
                <Ionicons
                  name={focused ? tab.activeIcon : tab.icon}
                  size={22}
                  color={focused ? '#ffffff' : 'rgba(255,255,255,0.55)'}
                />
                <Text style={[
                  styles.label,
                  { color: focused ? '#ffffff' : 'rgba(255,255,255,0.60)' },
                  focused && styles.labelActive,
                ]}>
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// Keep named export for backwards compat with any remaining import
export { DockTabBar as DriverDockTabBar };

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  blur: {
    position: 'relative',
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  inner: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 24,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: {
    fontWeight: '700',
  },
});
