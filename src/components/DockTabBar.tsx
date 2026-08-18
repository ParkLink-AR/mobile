import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}

const DRIVER_TABS: TabConfig[] = [
  { name: 'index',    label: 'Buscar',   icon: 'search-outline',   activeIcon: 'search' },
  { name: 'bookings', label: 'Reservas', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'profile',  label: 'Perfil',   icon: 'person-outline',   activeIcon: 'person' },
];

const OWNER_TABS: TabConfig[] = [
  { name: 'index',    label: 'Inicio',   icon: 'home-outline',     activeIcon: 'home' },
  { name: 'spots',    label: 'Cocheras', icon: 'car-outline',      activeIcon: 'car' },
  { name: 'bookings', label: 'Reservas', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'profile',  label: 'Perfil',   icon: 'person-outline',   activeIcon: 'person' },
];

interface DockTabBarProps extends BottomTabBarProps {
  tabConfigs: TabConfig[];
}

export function DockTabBar({ state, navigation, tabConfigs }: DockTabBarProps) {
  const colors = useThemeColors();
  const mode = useSettingsStore((s) => s.mode);
  const insets = useSafeAreaInsets();

  const bgColor = mode === 'dark' ? 'rgba(16,110,112,0.92)' : 'rgba(16,110,112,0.95)';

  return (
    <View
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={30}
        tint="dark"
        style={[styles.blur, { backgroundColor: bgColor }]}
      >
        <View style={styles.inner}>
          {tabConfigs.map((tab, index) => {
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
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

export function DriverDockTabBar(props: BottomTabBarProps) {
  return <DockTabBar {...props} tabConfigs={DRIVER_TABS} />;
}

export function OwnerDockTabBar(props: BottomTabBarProps) {
  return <DockTabBar {...props} tabConfigs={OWNER_TABS} />;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  blur: {
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
