import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, TouchableWithoutFeedback, StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { t } from '@/src/i18n';
import { Button } from '@/src/components/Button';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
import { VehicleTypeOptions } from '@/src/components/VehicleTypeOptions';
import { isValidArgentinePlate } from '@/src/components/VehiclePlate';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { createVehicle } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import {
  BICYCLE, VEHICLE_TYPES, VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABEL_KEYS, VehicleType,
} from '@/src/constants/vehicleTypes';
import { Vehicle } from '@/src/types';

/**
 * "Agregar vehículo", in two steps so it never shows everything at once: first its type
 * (with examples) and "Siguiente", then its details for that type -- plate, brand and
 * model, or, for a bicycle, just an optional brand/description, since it has no plate.
 * Shared by "Mis vehículos" and the booking screens, where a driver adds one without
 * leaving the booking. `types` narrows the type options (e.g. to the ones a spot fits); with
 * a single one there's nothing to choose and it opens straight on the details.
 */
export function VehicleFormModal({
  visible,
  userId,
  types = VEHICLE_TYPES,
  onClose,
  onCreated,
}: {
  visible: boolean;
  userId: string;
  types?: readonly VehicleType[];
  onClose: () => void;
  onCreated: (vehicle: Vehicle) => void;
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [type, setType] = useState<VehicleType | null>(null);
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // With a single option there's nothing to choose.
  const singleType = types.length === 1;
  const effectiveType = singleType ? types[0] : type;
  const bicycle = effectiveType === BICYCLE;
  const onDetails = singleType || step === 'details';

  function reset() {
    setType(null);
    setStep('type');
    setPlate('');
    setBrand('');
    setModel('');
    setError(null);
  }

  function close() {
    if (saving) return;
    reset();
    onClose();
  }

  function goToDetails() {
    if (!effectiveType) {
      setError(t('vehicles.error.typeRequired'));
      return;
    }
    setError(null);
    setStep('details');
  }

  function backToType() {
    setError(null);
    setStep('type');
  }

  async function handleSave() {
    if (!effectiveType) {
      setError(t('vehicles.error.typeRequired'));
      return;
    }
    if (!bicycle) {
      if (!plate.trim() || !brand.trim() || !model.trim()) {
        setError(t('vehicles.error.required'));
        return;
      }
      // Argentina only issues these domain formats -- same check auth-service enforces
      // server-side (see schemas.VehicleCreate), surfaced here so the driver doesn't wait
      // for a round-trip to find out.
      if (!isValidArgentinePlate(plate)) {
        setError(t('vehicles.error.invalidArPlate'));
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createVehicle(userId, {
        type: effectiveType,
        plate: bicycle ? undefined : plate.trim(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        country: 'AR',
      });
      reset();
      onCreated(created);
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
    label: { fontSize: sc(13), fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: sc(15), color: colors.text },
    hint: { fontSize: sc(12), color: colors.textSecondary },
    error: { color: '#C62828', fontSize: sc(13) },
    stepText: { fontSize: sc(12), fontWeight: '600', color: colors.textSecondary },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    chosen: {
      flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start',
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.teal + '14',
    },
    chosenText: { fontSize: sc(14), fontWeight: '700', color: colors.teal },
    changeType: { fontSize: sc(13), fontWeight: '600', color: colors.teal },
    actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  });

  const optional = bicycle ? ` (${t('vehicles.optional')})` : '';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <ModalKeyboardAvoider>
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheet}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{t('vehicles.add')}</Text>
                    {!singleType ? (
                      <Text style={styles.stepText}>{t('vehicles.step', { step: onDetails ? '2' : '1' })}</Text>
                    ) : null}
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  {!onDetails ? (
                    <>
                      <Text style={styles.label}>{t('vehicles.type')}</Text>
                      <VehicleTypeOptions value={type} onChange={(next) => { setType(next); setError(null); }} types={types} />
                      <View style={styles.actions}>
                        <Pressable style={styles.cancelBtn} onPress={close}>
                          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Button title={t('vehicles.next')} onPress={goToDetails} disabled={!effectiveType} />
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      {effectiveType ? (
                        <View style={styles.titleRow}>
                          <View style={styles.chosen}>
                            <MaterialCommunityIcons name={VEHICLE_TYPE_ICONS[effectiveType]} size={sc(20)} color={colors.teal} />
                            <Text style={styles.chosenText}>{t(VEHICLE_TYPE_LABEL_KEYS[effectiveType])}</Text>
                          </View>
                          {!singleType ? (
                            <Text style={styles.changeType} onPress={backToType}>{t('vehicles.changeType')}</Text>
                          ) : null}
                        </View>
                      ) : null}

                      {!bicycle && (
                        <View>
                          <Text style={styles.label}>{t('vehicles.plate')}</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="AB123CD"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="characters"
                            maxLength={10}
                            value={plate}
                            onChangeText={setPlate}
                          />
                        </View>
                      )}

                      <View>
                        <Text style={styles.label}>{t('vehicles.brand')}{optional}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder={bicycle ? 'Venzo' : 'Toyota'}
                          placeholderTextColor={colors.textSecondary}
                          value={brand}
                          onChangeText={setBrand}
                        />
                      </View>

                      <View>
                        <Text style={styles.label}>{t('vehicles.model')}{optional}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder={bicycle ? t('vehicles.bicycle.modelPlaceholder') : 'Corolla'}
                          placeholderTextColor={colors.textSecondary}
                          value={model}
                          onChangeText={setModel}
                        />
                      </View>
                      {bicycle ? <Text style={styles.hint}>{t('vehicles.bicycle.hint')}</Text> : null}

                      <View style={styles.actions}>
                        <Pressable style={styles.cancelBtn} onPress={singleType ? close : backToType}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {!singleType ? <Ionicons name="chevron-back" size={sc(16)} color={colors.textSecondary} /> : null}
                            <Text style={styles.cancelBtnText}>{t(singleType ? 'common.cancel' : 'vehicles.back')}</Text>
                          </View>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          {saving ? <ActivityIndicator color={colors.teal} /> : <Button title={t('vehicles.save')} onPress={handleSave} />}
                        </View>
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </ModalKeyboardAvoider>
    </Modal>
  );
}
