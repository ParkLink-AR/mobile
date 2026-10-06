import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

type Role = 'driver' | 'owner';

/** The icon and color that identify each side of the app -- shared by RoleBadge (the
 * labeled chip on screen headers) and RoleIcon (the bare icon on each notification). */
function useRoleAppearance(role: Role) {
  const colors = useThemeColors();
  // deepNavy es fijo entre temas (no como colors.text), así que en modo
  // oscuro quedaba prácticamente invisible sobre el fondo oscuro -- colors.text
  // ya resuelve correctamente a algo legible en ambos temas (coincide con
  // deepNavy en claro, así que no cambia nada ahí).
  const color = role === 'owner' ? colors.text : colors.teal;
  const icon: keyof typeof Ionicons.glyphMap = role === 'owner' ? 'business' : 'car-sport';
  const a11yLabel = t(role === 'owner' ? 'roleBadge.ownerA11y' : 'roleBadge.driverA11y');
  return { color, icon, a11yLabel };
}

/** Small chip showing whether the current screen belongs to the driver or owner route group. */
export function RoleBadge() {
  const role: Role = useSegments()[0] === '(owner)' ? 'owner' : 'driver';
  const { color, icon, a11yLabel } = useRoleAppearance(role);
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  const styles = StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: `${color}1A`,
    },
    label: { fontSize: sc(12), fontWeight: '700', color },
  });

  return (
    <View style={styles.badge} accessibilityLabel={a11yLabel}>
      <Ionicons name={icon} size={sc(13)} color={color} />
      <Text style={styles.label}>{t(role === 'owner' ? 'roleBadge.owner' : 'roleBadge.driver')}</Text>
    </View>
  );
}

/** Same car/building as RoleBadge, without the label -- marks which side of the app a
 * single item (e.g. a notification) belongs to. */
export function RoleIcon({ role }: { role: Role }) {
  const { color, icon, a11yLabel } = useRoleAppearance(role);

  const styles = StyleSheet.create({
    badge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${color}1A`,
    },
  });

  return (
    <View style={styles.badge} accessibilityLabel={a11yLabel}>
      <Ionicons name={icon} size={13} color={color} />
    </View>
  );
}
