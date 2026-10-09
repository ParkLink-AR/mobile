import { t } from '@/src/i18n';
import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { Button } from '@/src/components/Button';
import { VehicleIdentity, vehicleName } from '@/src/components/VehicleIdentity';
import { VehicleFormModal } from '@/src/components/VehicleFormModal';
import { VehicleTypeModal } from '@/src/components/VehicleTypeModal';
import { BICYCLE, VEHICLE_TYPE_LABEL_KEYS, VehicleType } from '@/src/constants/vehicleTypes';
import { Vehicle } from '@/src/types';

interface VehiclePickerProps {
  userId: string;
  vehicles: Vehicle[];
  selected: Vehicle | null;
  onSelect: (vehicle: Vehicle | null) => void;
  /** A vehicle was added or had its type filled in from here -- the caller's list updates. */
  onVehicleSaved: (vehicle: Vehicle) => void;
  /** The vehicle types the spot fits. */
  acceptedTypes: VehicleType[];
  /** The spot asks for the vehicle, or prices by it: no "Ninguno", and a plate is a must
   * (except for a bicycle) -- see spotNeedsVehicle. */
  required: boolean;
}

/** Why a saved vehicle can't be picked for this spot, or null if it can. */
function unavailableReason(vehicle: Vehicle, acceptedTypes: VehicleType[], required: boolean): string | null {
  if (!vehicle.type) return t('vehicles.picker.needsType');
  if (!acceptedTypes.includes(vehicle.type)) {
    return t('vehicles.picker.notAccepted', { type: t(VEHICLE_TYPE_LABEL_KEYS[vehicle.type]).toLowerCase() });
  }
  if (required && vehicle.type !== BICYCLE && !vehicle.plate) return t('vehicles.picker.needsPlate');
  return null;
}

/**
 * The booking confirm screens' "Tu vehículo". Optional unless `required` (then there's no
 * "Ninguno" option). Vehicles the spot doesn't fit are listed but disabled, saying why; one
 * saved before types existed can get its type right here, and a new one can be added
 * without leaving the booking (limited to the types the spot fits).
 */
export function VehiclePicker({
  userId, vehicles, selected, onSelect, onVehicleSaved, acceptedTypes, required,
}: VehiclePickerProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [visible, setVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [typeTarget, setTypeTarget] = useState<Vehicle | null>(null);

  const styles = StyleSheet.create({
    selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    selectedInfo: { flex: 1 },
    selectedName: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    selectedType: { fontSize: sc(12), color: colors.textSecondary, marginTop: 1 },
    changeLink: { fontSize: sc(13), color: colors.teal, fontWeight: '600', marginTop: 2 },
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.3)', justifyContent: 'center', padding: 24 },
    dropdown: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
    scrollArea: { maxHeight: 360 },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    optionSelected: { backgroundColor: colors.background },
    optionDisabled: { opacity: 0.55 },
    optionInfo: { flex: 1 },
    optionName: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    optionType: { fontSize: sc(12), color: colors.textSecondary, marginTop: 1 },
    optionReason: { fontSize: sc(12), color: colors.warning, marginTop: 1 },
    optionFix: { fontSize: sc(12), color: colors.teal, fontWeight: '600', marginTop: 1 },
    noneOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    noneOptionText: { fontSize: sc(14), color: colors.textSecondary },
    addOption: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    addOptionText: { fontSize: sc(14), color: colors.teal, fontWeight: '600' },
    emptyHint: { fontSize: sc(13), color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  });

  function openAdd() {
    setVisible(false);
    setAdding(true);
  }

  return (
    <>
      {selected ? (
        <View style={styles.selectedRow}>
          <VehicleIdentity vehicle={selected} />
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{vehicleName(selected)}</Text>
            {selected.type ? <Text style={styles.selectedType}>{t(VEHICLE_TYPE_LABEL_KEYS[selected.type])}</Text> : null}
            <Text style={styles.changeLink} onPress={() => setVisible(true)}>
              {t('vehicles.change')}
            </Text>
          </View>
        </View>
      ) : vehicles.length === 0 ? (
        <Button title={t('vehicles.add')} onPress={() => setAdding(true)} />
      ) : (
        <Button title={t('vehicles.select')} onPress={() => setVisible(true)} />
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.dropdown}>
            {vehicles.length === 0 ? (
              <Text style={styles.emptyHint}>{t('vehicles.pickerEmpty')}</Text>
            ) : (
              <ScrollView style={styles.scrollArea}>
                {!required && (
                  <Pressable
                    style={styles.noneOption}
                    onPress={() => {
                      onSelect(null);
                      setVisible(false);
                    }}
                  >
                    <Text style={styles.noneOptionText}>{t('vehicles.none')}</Text>
                  </Pressable>
                )}
                {vehicles.map((vehicle) => {
                  const reason = unavailableReason(vehicle, acceptedTypes, required);
                  const isSelected = selected?.id === vehicle.id;
                  return (
                    <Pressable
                      key={vehicle.id}
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => {
                        if (!vehicle.type) {
                          // Saved before types existed: fill it in, then it can be picked.
                          setVisible(false);
                          setTypeTarget(vehicle);
                          return;
                        }
                        if (reason) return;
                        onSelect(vehicle);
                        setVisible(false);
                      }}
                    >
                      <View style={reason && vehicle.type ? styles.optionDisabled : undefined}>
                        <VehicleIdentity vehicle={vehicle} />
                      </View>
                      <View style={[styles.optionInfo, reason && vehicle.type ? styles.optionDisabled : undefined]}>
                        <Text style={styles.optionName}>{vehicleName(vehicle)}</Text>
                        {vehicle.type ? (
                          <Text style={styles.optionType}>{t(VEHICLE_TYPE_LABEL_KEYS[vehicle.type])}</Text>
                        ) : null}
                        {reason ? (
                          <Text style={vehicle.type ? styles.optionReason : styles.optionFix}>{reason}</Text>
                        ) : null}
                      </View>
                      {isSelected && <Ionicons name="checkmark" size={sc(18)} color={colors.teal} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable style={styles.addOption} onPress={openAdd}>
              <Ionicons name="add-circle-outline" size={sc(18)} color={colors.teal} />
              <Text style={styles.addOptionText}>{t('vehicles.add')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <VehicleFormModal
        visible={adding}
        userId={userId}
        types={acceptedTypes}
        onClose={() => setAdding(false)}
        onCreated={(created) => {
          setAdding(false);
          onVehicleSaved(created);
          onSelect(created);
        }}
      />

      <VehicleTypeModal
        vehicle={typeTarget}
        userId={userId}
        onClose={() => setTypeTarget(null)}
        onSaved={(updated) => {
          setTypeTarget(null);
          onVehicleSaved(updated);
          if (!unavailableReason(updated, acceptedTypes, required)) onSelect(updated);
        }}
      />
    </>
  );
}
