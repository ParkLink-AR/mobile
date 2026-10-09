import { View, Text, Switch, StyleSheet } from 'react-native';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

/**
 * "Pedir el vehículo al reservar" -- see ParkingSpot.requireVehicle in parking-service.
 * Shared by spots/new.tsx and spots/[id]/edit.tsx. A spot that charges per vehicle type
 * always asks for it (it's how the price is known), so then the switch shows on and locked.
 */
export function RequireVehicleSetting({
  value,
  onChange,
  pricedPerVehicle,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  pricedPerVehicle: boolean;
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 },
    labelBlock: { flex: 1, gap: 2 },
    label: { fontSize: sc(13), fontWeight: '600', color: colors.text },
    hint: { fontSize: sc(12), color: colors.textSecondary },
  });
  return (
    <View style={styles.row}>
      <View style={styles.labelBlock}>
        <Text style={styles.label}>{t('owner.spot.requireVehicle')}</Text>
        <Text style={styles.hint}>
          {t(pricedPerVehicle ? 'owner.spot.requireVehicle.pricedHint' : 'owner.spot.requireVehicle.hint')}
        </Text>
      </View>
      <Switch
        value={value || pricedPerVehicle}
        onValueChange={onChange}
        disabled={pricedPerVehicle}
        trackColor={{ true: colors.teal }}
      />
    </View>
  );
}
