import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import {
  Text,
  View,
  FlatList,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { usePlateAssetsReady } from '@/src/components/VehiclePlate';
import { VehicleIdentity, vehicleName } from '@/src/components/VehicleIdentity';
import { VehicleFormModal } from '@/src/components/VehicleFormModal';
import { VehicleTypeModal } from '@/src/components/VehicleTypeModal';
import { VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getVehicles, deleteVehicle } from '@/src/api/auth';
import { Vehicle } from '@/src/types';

export default function VehiclesScreen() {
  useLanguage();
  const colors = useThemeColors();
  const user = useSessionStore((s) => s.user)!;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  // Keep the spinner until the plate images are in too, so the list shows up complete.
  const platesReady = usePlateAssetsReady();

  const [formVisible, setFormVisible] = useState(false);
  // A failed load must not look like "no tenés vehículos" -- see the error state below.
  const [loadFailed, setLoadFailed] = useState(false);
  // A vehicle saved before types existed, whose type the driver is filling in.
  const [typeTarget, setTypeTarget] = useState<Vehicle | null>(null);

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
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    vehicleInfo: { flex: 1 },
    vehicleBrandModel: { fontSize: 15, fontWeight: '700', color: colors.text },
    vehicleType: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    completeType: { fontSize: 13, fontWeight: '600', color: colors.warning, marginTop: 2 },
    deleteBtn: { padding: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
    deleteWarning: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    deleteConfirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#C62828' },
    deleteConfirmBtnText: { color: colors.white, fontWeight: '700' },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      {loading || !platesReady ? (
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
                <VehicleIdentity vehicle={item} />
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleBrandModel}>{vehicleName(item)}</Text>
                  {item.type ? (
                    <Text style={styles.vehicleType}>{t(VEHICLE_TYPE_LABEL_KEYS[item.type])}</Text>
                  ) : (
                    // Saved before vehicles had a type: it can't be used for a spot that
                    // asks for the vehicle until it has one.
                    <Text style={styles.completeType} onPress={() => setTypeTarget(item)}>
                      {t('vehicles.completeType.action')}
                    </Text>
                  )}
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => setDeleteTarget(item)}>
                  <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Button title={t('vehicles.add')} onPress={() => setFormVisible(true)} />

      {/* Add vehicle */}
      <VehicleFormModal
        visible={formVisible}
        userId={user.id}
        onClose={() => setFormVisible(false)}
        onCreated={(created) => {
          setVehicles((prev) => [...prev, created]);
          setFormVisible(false);
        }}
      />

      <VehicleTypeModal
        vehicle={typeTarget}
        userId={user.id}
        onClose={() => setTypeTarget(null)}
        onSaved={(updated) => {
          setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
          setTypeTarget(null);
        }}
      />

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
