import { t } from '@/src/i18n';
import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { Button } from '@/src/components/Button';
import { VehiclePlate } from '@/src/components/VehiclePlate';
import { Vehicle } from '@/src/types';

interface VehiclePickerProps {
  vehicles: Vehicle[];
  selected: Vehicle | null;
  onSelect: (vehicle: Vehicle | null) => void;
  /** Where "Agregar vehículo" navigates -- the owner/driver "Mis vehículos" route group. */
  vehiclesScreenPath: string;
}

/** The booking confirm screen's "Seleccionar vehículo" entry point -- entirely optional
 * (see the Card wrapping this in confirm.tsx/confirm-stay.tsx), so unlike
 * PaymentMethodPicker there's no always-selected default: `selected` starts null and a
 * "Ninguno" option lets the driver clear a prior pick. Each option renders the real plate
 * graphic (VehiclePlate), not just text, per how this was asked for. */
export function VehiclePicker({ vehicles, selected, onSelect, vehiclesScreenPath }: VehiclePickerProps) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  const styles = StyleSheet.create({
    selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    selectedInfo: { flex: 1 },
    selectedBrandModel: { fontSize: 14, fontWeight: '600', color: colors.text },
    changeLink: { fontSize: 13, color: colors.teal, fontWeight: '600', marginTop: 2 },
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.3)', justifyContent: 'center', padding: 32 },
    dropdown: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
    scrollArea: { maxHeight: 320 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionSelected: { backgroundColor: colors.background },
    optionInfo: { flex: 1 },
    optionBrandModel: { fontSize: 14, fontWeight: '600', color: colors.text },
    noneOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    noneOptionText: { fontSize: 14, color: colors.textSecondary },
    addOption: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    addOptionText: { fontSize: 14, color: colors.teal, fontWeight: '600' },
    emptyHint: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  });

  function openVehiclesScreen() {
    setVisible(false);
    router.push(vehiclesScreenPath as never);
  }

  return (
    <>
      {selected ? (
        <View style={styles.selectedRow}>
          <VehiclePlate plate={selected.plate} size="small" />
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedBrandModel}>{selected.brand} {selected.model}</Text>
            <Text style={styles.changeLink} onPress={() => setVisible(true)}>
              {t('vehicles.change')}
            </Text>
          </View>
        </View>
      ) : null}

      {!selected && (
        <Button title={t('vehicles.select')} onPress={() => setVisible(true)} />
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.dropdown}>
            {vehicles.length === 0 ? (
              <Text style={styles.emptyHint}>{t('vehicles.pickerEmpty')}</Text>
            ) : (
              <ScrollView style={styles.scrollArea}>
                <Pressable
                  style={styles.noneOption}
                  onPress={() => {
                    onSelect(null);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.noneOptionText}>{t('vehicles.none')}</Text>
                </Pressable>
                {vehicles.map((vehicle) => (
                  <Pressable
                    key={vehicle.id}
                    style={[styles.option, selected?.id === vehicle.id && styles.optionSelected]}
                    onPress={() => {
                      onSelect(vehicle);
                      setVisible(false);
                    }}
                  >
                    <VehiclePlate plate={vehicle.plate} size="small" />
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionBrandModel}>{vehicle.brand} {vehicle.model}</Text>
                    </View>
                    {selected?.id === vehicle.id && <Ionicons name="checkmark" size={18} color={colors.teal} />}
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.addOption} onPress={openVehiclesScreen}>
              <Ionicons name="add-circle-outline" size={18} color={colors.teal} />
              <Text style={styles.addOptionText}>{t('vehicles.add')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
