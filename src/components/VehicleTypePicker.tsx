import { View, StyleSheet } from 'react-native';
import { Chip } from '@/src/components/Chip';
import { VEHICLE_TYPES, VEHICLE_TYPE_LABEL_KEYS, VehicleType } from '@/src/constants/vehicleTypes';
import { t } from '@/src/i18n';

interface VehicleTypePickerProps {
  value: VehicleType[];
  onChange: (value: VehicleType[]) => void;
}

/**
 * Multi-selección de tipos de vehículo para los que es apta la cochera --
 * chips tocables, mismo componente que ya se usa para mostrar tags de sólo
 * lectura (spot/[id].tsx), acá con onPress para togglear cada uno.
 */
export function VehicleTypePicker({ value, onChange }: VehicleTypePickerProps) {
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap' },
  });

  function toggle(type: VehicleType) {
    onChange(value.includes(type) ? value.filter((v) => v !== type) : [...value, type]);
  }

  return (
    <View style={styles.row}>
      {VEHICLE_TYPES.map((type) => (
        <Chip
          key={type}
          label={t(VEHICLE_TYPE_LABEL_KEYS[type])}
          selected={value.includes(type)}
          onPress={() => toggle(type)}
        />
      ))}
    </View>
  );
}
