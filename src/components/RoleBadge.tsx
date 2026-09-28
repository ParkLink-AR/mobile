import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';

/** Small chip showing whether the current screen belongs to the driver or owner route group. */
export function RoleBadge() {
  const segment = useSegments()[0];
  const colors = useThemeColors();
  const isOwner = segment === '(owner)';
  const color = isOwner ? colors.deepNavy : colors.teal;

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
    label: { fontSize: 12, fontWeight: '700', color },
  });

  return (
    <View style={styles.badge} accessibilityLabel={t(isOwner ? 'roleBadge.ownerA11y' : 'roleBadge.driverA11y')}>
      <Ionicons name={isOwner ? 'business' : 'car-sport'} size={13} color={color} />
      <Text style={styles.label}>{t(isOwner ? 'roleBadge.owner' : 'roleBadge.driver')}</Text>
    </View>
  );
}
