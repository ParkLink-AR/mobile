import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TouchableWithoutFeedback, StyleSheet, ActivityIndicator } from 'react-native';
import { t } from '@/src/i18n';
import { Button } from '@/src/components/Button';
import { VehicleTypeOptions } from '@/src/components/VehicleTypeOptions';
import { vehicleName } from '@/src/components/VehicleIdentity';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { updateVehicleType } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { BICYCLE, VEHICLE_TYPES, VehicleType } from '@/src/constants/vehicleTypes';
import { Vehicle } from '@/src/types';

// A vehicle saved before types existed always has a plate -- it's never a bicycle.
const TYPES_WITH_PLATE = VEHICLE_TYPES.filter((type) => type !== BICYCLE);

/** Asks for the type of a vehicle saved before vehicles had one ("¿Qué es tu Toyota Corolla?"). */
export function VehicleTypeModal({
  vehicle,
  userId,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle | null;
  userId: string;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [type, setType] = useState<VehicleType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (saving) return;
    setType(null);
    setError(null);
    onClose();
  }

  async function save() {
    if (!vehicle || !type) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateVehicleType(userId, vehicle.id, type);
      setType(null);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('vehicles.error.generic'));
    } finally {
      setSaving(false);
    }
  }

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    sheet: { backgroundColor: colors.surface, borderRadius: 16, maxHeight: '90%' },
    content: { padding: 20, gap: 12 },
    title: { fontSize: sc(17), fontWeight: '700', color: colors.text },
    body: { fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(20) },
    error: { color: '#C62828', fontSize: sc(13) },
    actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  });

  return (
    <Modal visible={vehicle !== null} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{t('vehicles.completeType.title', { name: vehicle ? vehicleName(vehicle) : '' })}</Text>
                <Text style={styles.body}>{t('vehicles.completeType.body')}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <VehicleTypeOptions value={type} onChange={setType} types={TYPES_WITH_PLATE} />
                <View style={styles.actions}>
                  <Pressable style={styles.cancelBtn} onPress={close}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    {saving ? <ActivityIndicator color={colors.teal} /> : <Button title={t('vehicles.save')} onPress={save} disabled={!type} />}
                  </View>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
