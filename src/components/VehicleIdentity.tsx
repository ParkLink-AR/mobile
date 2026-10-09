import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { VehiclePlate, PlateAlign } from '@/src/components/VehiclePlate';
import { VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { VehicleSnapshot } from '@/src/types';

/** "Toyota Corolla" -- or, for a bicycle saved without brand/model, its type ("Bicicleta"). */
export function vehicleName(vehicle: VehicleSnapshot): string {
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  if (name) return name;
  return vehicle.type ? t(VEHICLE_TYPE_LABEL_KEYS[vehicle.type]) : '';
}

/** "Renault Trafic · Van / Furgón" -- what it is, without its plate. */
export function vehicleDescription(vehicle: VehicleSnapshot): string {
  return [vehicleName(vehicle), vehicle.type ? t(VEHICLE_TYPE_LABEL_KEYS[vehicle.type]) : null]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(' · ');
}

/** "Renault Trafic · Van / Furgón · AB123CD" -- one line of plain text (no plate graphic),
 * e.g. for the owner, who needs to know what's coming and its plate. */
export function vehicleSummary(vehicle: VehicleSnapshot): string {
  return [vehicleDescription(vehicle), vehicle.plate].filter(Boolean).join(' · ');
}

/**
 * How a vehicle is recognized at a glance: its plate graphic, or -- for a bicycle, which
 * has none -- its type's icon in a plate-sized badge, so lists line up either way.
 */
export function VehicleIdentity({
  vehicle,
  size = 'small',
  align,
}: {
  vehicle: VehicleSnapshot;
  size?: 'large' | 'small';
  align?: PlateAlign;
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  if (vehicle.plate) return <VehiclePlate plate={vehicle.plate} size={size} align={align} />;

  const styles = StyleSheet.create({
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: size === 'large' ? 10 : 6,
      borderRadius: 8, backgroundColor: colors.teal + '14',
      alignSelf: align === 'end' ? 'flex-end' : 'flex-start',
    },
    text: { fontSize: sc(13), fontWeight: '600', color: colors.teal },
  });
  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name={VEHICLE_TYPE_ICONS[vehicle.type ?? 'bicycle']} size={sc(18)} color={colors.teal} />
      <Text style={styles.text}>{vehicle.type ? t(VEHICLE_TYPE_LABEL_KEYS[vehicle.type]) : ''}</Text>
    </View>
  );
}
