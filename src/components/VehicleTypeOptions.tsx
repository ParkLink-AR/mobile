import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import {
  VEHICLE_TYPES, VEHICLE_TYPE_EXAMPLE_KEYS, VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABEL_KEYS, VehicleType,
} from '@/src/constants/vehicleTypes';

/**
 * Single choice of a vehicle's type: one row per type with its icon, name and examples
 * ("Trafic, Sprinter, Master…"), so it's clear where each vehicle goes. `types` narrows the
 * options (e.g. the ones a spot fits).
 */
export function VehicleTypeOptions({
  value,
  onChange,
  types = VEHICLE_TYPES,
}: {
  value: VehicleType | null;
  onChange: (type: VehicleType) => void;
  types?: readonly VehicleType[];
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  const styles = StyleSheet.create({
    list: { gap: 6 },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    optionSelected: { borderColor: colors.teal, backgroundColor: colors.teal + '12' },
    text: { flex: 1 },
    label: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    examples: { fontSize: sc(12), color: colors.textSecondary, marginTop: 1 },
  });

  return (
    <View style={styles.list}>
      {types.map((type) => {
        const selected = value === type;
        return (
          <Pressable
            key={type}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(type)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <MaterialCommunityIcons name={VEHICLE_TYPE_ICONS[type]} size={sc(22)} color={selected ? colors.teal : colors.textSecondary} />
            <View style={styles.text}>
              <Text style={styles.label}>{t(VEHICLE_TYPE_LABEL_KEYS[type])}</Text>
              <Text style={styles.examples}>{t(VEHICLE_TYPE_EXAMPLE_KEYS[type])}</Text>
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={sc(20)} color={colors.teal} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
