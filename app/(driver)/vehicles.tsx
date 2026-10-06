import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import {
  Text,
  TextInput,
  View,
  FlatList,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
import { Screen } from '@/src/components/Screen';
import { VehiclePlate, isValidArgentinePlate } from '@/src/components/VehiclePlate';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getVehicles, createVehicle, deleteVehicle } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { Vehicle } from '@/src/types';

export default function VehiclesScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed load must not look like "no tenés vehículos" -- see the error state below.
  const [loadFailed, setLoadFailed] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    getVehicles(user.id)
      .then(setVehicles)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [user.id]);

  useFocusEffect(load);

  function openForm() {
    setPlate('');
    setBrand('');
    setModel('');
    setError(null);
    setFormVisible(true);
  }

  async function handleSave() {
    if (!plate.trim() || !brand.trim() || !model.trim()) {
      setError(t('vehicles.error.required'));
      return;
    }
    // Argentina only issues two domain formats (ABC123 pre-2016, AB123CD since) -- same
    // check auth-service enforces server-side (see schemas.VehicleCreate), surfaced here
    // too so the driver doesn't wait for a round-trip to find out.
    if (!isValidArgentinePlate(plate)) {
      setError(t('vehicles.error.invalidArPlate'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createVehicle(user.id, {
        plate: plate.trim(),
        brand: brand.trim(),
        model: model.trim(),
        country: 'AR',
      });
      setVehicles((prev) => [...prev, created]);
      setFormVisible(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('vehicles.error.generic'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVehicle(user.id, deleteTarget.id);
      setVehicles((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // The row stays in the list -- the user can just retry the delete.
    } finally {
      setDeleting(false);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    vehicleInfo: { flex: 1 },
    vehicleBrandModel: { fontSize: 15, fontWeight: '700', color: colors.text },
    deleteBtn: { padding: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, color: colors.text },
    error: { color: '#C62828', fontSize: 13 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
    deleteWarning: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    deleteConfirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#C62828' },
    deleteConfirmBtnText: { color: colors.white, fontWeight: '700' },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.headerRow}>
        <Text style={typography.h1}>{t('vehicles.title')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : loadFailed ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('common.loadError')}</Text>
          <Button title={t('common.retry')} onPress={load} />
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={vehicles.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{t('vehicles.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.vehicleRow}>
                <VehiclePlate plate={item.plate} size="small" />
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleBrandModel}>{item.brand} {item.model}</Text>
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => setDeleteTarget(item)}>
                  <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Button title={t('vehicles.add')} onPress={openForm} />

      {/* Add vehicle */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <ModalKeyboardAvoider>
          <TouchableWithoutFeedback onPress={() => setFormVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalSheet}>
                  <Text style={styles.modalTitle}>{t('vehicles.add')}</Text>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

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

                  <View>
                    <Text style={styles.label}>{t('vehicles.brand')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Toyota"
                      placeholderTextColor={colors.textSecondary}
                      value={brand}
                      onChangeText={setBrand}
                    />
                  </View>

                  <View>
                    <Text style={styles.label}>{t('vehicles.model')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Corolla"
                      placeholderTextColor={colors.textSecondary}
                      value={model}
                      onChangeText={setModel}
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable style={styles.cancelBtn} onPress={() => setFormVisible(false)}>
                      <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      {saving ? (
                        <ActivityIndicator color={colors.teal} />
                      ) : (
                        <Button title={t('vehicles.save')} onPress={handleSave} />
                      )}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </ModalKeyboardAvoider>
      </Modal>

      {/* Delete confirmation */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <TouchableWithoutFeedback onPress={() => setDeleteTarget(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('vehicles.deleteConfirmTitle')}</Text>
                <Text style={styles.deleteWarning}>{t('vehicles.deleteConfirmMessage')}</Text>
                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setDeleteTarget(null)}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteConfirmBtn, { opacity: deleting ? 0.7 : 1 }]}
                    onPress={handleDelete}
                  >
                    <Text style={styles.deleteConfirmBtnText}>{t('vehicles.delete')}</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}
