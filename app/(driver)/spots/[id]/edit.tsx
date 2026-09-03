import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Image, TouchableOpacity, ActivityIndicator, Switch, Modal, TouchableWithoutFeedback,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { RatingStars } from '@/src/components/RatingStars';
import { AvailabilityPicker, DayScheduleGroup, dayGroupsToEntries, entriesToDayGroups } from '@/src/components/AvailabilityPicker';
import { AddressAutocomplete } from '@/src/components/AddressAutocomplete';
import { useThemeColors } from '@/src/theme/useThemeColors';
import {
  getParkingSpotDetail,
  updateParkingSpot,
  updateParkingSpotStatus,
  deleteParkingSpot,
  uploadParkingSpotPhotos,
  deleteParkingSpotPhoto,
  reorderParkingSpotPhotos,
} from '@/src/services/parkingService';
import { useSpotsStore } from '@/src/store/useSpotsStore';
import { GeocodeCandidate, ParkingSpotPhotoAsset, reverseGeocode } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditSpot() {
  const colors = useThemeColors();
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const markUpdated = useSpotsStore((s) => s.markUpdated);
  const clearSpots = useSpotsStore((s) => s.clearSpots);

  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressSuggestionsOpen, setAddressSuggestionsOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [description, setDescription] = useState('');
  const [covered, setCovered] = useState(true);
  const [instantBooking, setInstantBooking] = useState(true);
  const [schedule, setSchedule] = useState<DayScheduleGroup[]>(
    [0, 1, 2, 3, 4].map((d) => ({ dayIndex: d, slots: [{ startHour: 8, endHour: 20 }] })),
  );
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getParkingSpotDetail(id).then((s) => {
        if (!s) return;
        setSpot(s);
        setAddress(s.address);
        setCoordinates({ lat: s.lat, lng: s.lng });
        setPrice(String(s.pricePerHour));
        setCapacity(String(s.capacity ?? 1));
        setDescription(s.description ?? '');
        setCovered(s.covered);
        setInstantBooking(s.instantBooking);
        setPhotos(s.photos);
        if (s.schedule.length > 0) setSchedule(entriesToDayGroups(s.schedule));
      });
    }, [id]),
  );

  async function pickAndUploadPhotos() {
    if (photos.length >= MAX_PHOTOS) {
      alert(t('owner.spot.new.maxPhotos'));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert(t('owner.spot.new.photoPermissionError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
      base64: false,
    });
    if (result.canceled) return;

    const assets: ParkingSpotPhotoAsset[] = [];
    for (const asset of result.assets) {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) continue;
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) continue;
      assets.push({ uri: asset.uri, name: asset.fileName ?? `photo.${mimeType.split('/')[1]}`, type: mimeType });
    }
    if (assets.length === 0) return;

    try {
      setPhotosBusy(true);
      const updated = await uploadParkingSpotPhotos(id, assets);
      setPhotos(updated.photos);
    } catch {
      alert(t('owner.spot.edit.errorPhotos'));
    } finally {
      setPhotosBusy(false);
    }
  }

  async function handleDeletePhoto(url: string) {
    try {
      setPhotosBusy(true);
      const updated = await deleteParkingSpotPhoto(id, url);
      setPhotos(updated.photos);
    } catch {
      alert(t('owner.spot.edit.errorPhotos'));
    } finally {
      setPhotosBusy(false);
    }
  }

  async function handleSetCover(url: string) {
    const reordered = [url, ...photos.filter((p) => p !== url)];
    try {
      setPhotosBusy(true);
      const updated = await reorderParkingSpotPhotos(id, reordered);
      setPhotos(updated.photos);
    } catch {
      alert(t('owner.spot.edit.errorPhotos'));
    } finally {
      setPhotosBusy(false);
    }
  }

  function selectAddress(candidate: GeocodeCandidate) {
    setAddress(candidate.displayName);
    setCoordinates({ lat: candidate.lat, lng: candidate.lng });
    setLocationError(null);
  }

  function handleAddressChange(text: string) {
    setAddress(text);
    // Editing the text after picking one invalidates the coordinates it
    // came with -- force picking (or GPS) again before saving.
    setCoordinates(null);
  }

  async function useCurrentLocation() {
    setLocationError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(t('owner.spot.new.permissionError'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setCoordinates({ lat, lng });
      try {
        const reversed = await reverseGeocode(lat, lng);
        setAddress(reversed.displayName);
      } catch {
        setAddress(t('owner.spot.new.locationFallback'));
      }
    } catch {
      setLocationError(t('search.location.error'));
    } finally {
      setLocating(false);
    }
  }

  if (!spot) return null;

  async function save() {
    if (schedule.length === 0) {
      alert(t('owner.spot.edit.invalidHours'));
      return;
    }
    const parsedPrice = Number(price);
    if (!price.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
      alert(t('owner.spot.edit.invalidPrice'));
      return;
    }
    if (!address.trim() || !coordinates) {
      alert(t('owner.spot.new.requiredFields'));
      return;
    }
    try {
      setSaving(true);
      await updateParkingSpot(id, {
        pricePerHour: parsedPrice,
        description: description.trim(),
        covered,
        instantBooking,
        capacity: Math.max(1, Math.trunc(Number(capacity)) || 1),
        schedule: dayGroupsToEntries(schedule),
        address: address.trim(),
        lat: coordinates.lat,
        lng: coordinates.lng,
      });
      // 1. Limpiar la caché para que la lista no muestre datos viejos
      //    mientras llega la respuesta del re-fetch.
      clearSpots();
      // 2. Incrementar lastUpdated dispara el useEffect de spots.tsx
      //    de forma reactiva e inmediata, sin depender del ciclo de focus.
      markUpdated();
      router.back();
    } catch {
      alert(t('owner.spot.edit.errorSave'));
      setSaving(false);
    }
  }

  // Alert.alert with buttons is a no-op on web (react-native-web's Alert
  // module has no UI at all) -- a real Modal (below, in the JSX) works on
  // every platform, same pattern profile.tsx already uses for account
  // deletion.
  function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
    setConfirmModal({ title, body: message, confirmLabel, onConfirm });
  }

  function handleToggleActive() {
    if (!spot) return;
    const goingActive = !spot.active;
    confirmAction(
      goingActive ? t('owner.spot.edit.reactivateTitle') : t('owner.spot.edit.deactivateTitle'),
      goingActive ? t('owner.spot.edit.reactivateBody') : t('owner.spot.edit.deactivateBody'),
      goingActive ? t('owner.spot.edit.reactivate') : t('owner.spot.edit.deactivate'),
      async () => {
        setStatusBusy(true);
        try {
          const updated = await updateParkingSpotStatus(id, goingActive ? 'active' : 'paused');
          setSpot(updated);
          clearSpots();
          markUpdated();
        } catch {
          alert(t('owner.spot.edit.errorStatus'));
        } finally {
          setStatusBusy(false);
        }
      },
    );
  }

  function handleDelete() {
    confirmAction(
      t('owner.spot.edit.deleteTitle'),
      t('owner.spot.edit.deleteBody'),
      t('owner.spot.edit.delete'),
      async () => {
        setDeleteBusy(true);
        try {
          await deleteParkingSpot(id);
          clearSpots();
          markUpdated();
          router.replace('/(driver)/(tabs)/profile');
        } catch (err) {
          alert(err instanceof ApiError ? err.detail : t('owner.spot.edit.errorDelete'));
          setDeleteBusy(false);
        }
      },
    );
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },

    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 6,
    },
    spotTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    spotAddress: { fontSize: 13, color: colors.textSecondary },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },

    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 12, fontSize: 15, color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },

    toggleRow: { flexDirection: 'row', gap: 8 },
    toggle: {
      flex: 1, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    },
    toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    toggleTextActive: { color: colors.surface, fontWeight: '700' },

    instantBookingRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    },
    instantBookingLabelBlock: { flex: 1, gap: 2 },
    instantBookingHint: { fontSize: 12, color: colors.textSecondary },

    photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoThumbWrapper: { position: 'relative' },
    photoThumb: { width: 72, height: 72, borderRadius: 8 },
    coverBadge: {
      position: 'absolute', bottom: 2, left: 2,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4,
      paddingHorizontal: 4, paddingVertical: 1,
    },
    coverBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
    removePhotoBtn: {
      position: 'absolute', top: -6, right: -6,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center',
    },
    setCoverBtn: {
      position: 'absolute', bottom: 2, right: 2,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4,
      width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    },
    addPhotoThumb: {
      width: 72, height: 72, borderRadius: 8,
      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },

    locationCard: { zIndex: 20, elevation: 20 },
    addressRow: { flexDirection: 'row', gap: 8 },
    locateButton: {
      width: 46, height: 46, borderRadius: 8,
      backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    },
    locationConfirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationConfirmed: { color: colors.success, fontSize: 12, fontWeight: '700' },
    locationError: { color: '#C62828', fontSize: 12 },

    saveBtn: { marginTop: 4 },
    dangerBtn: {
      marginTop: 4, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 13, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border,
    },
    dangerBtnText: { fontWeight: '700', fontSize: 15, color: colors.text },
    deleteBtn: { borderColor: '#C62828' },
    deleteBtnText: { color: '#C62828' },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalSheet: {
      width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      backgroundColor: colors.surface, alignItems: 'center', gap: 8,
    },
    modalTitle: {
      fontSize: 16, fontWeight: '700', color: colors.text,
      marginBottom: 8, textAlign: 'center',
    },
    modalBody: {
      fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18,
      marginBottom: 8,
    },
    modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
    modalCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
    modalConfirmBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      backgroundColor: '#C62828',
    },
    modalConfirmBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Spot info (read-only) */}
          <View style={styles.infoCard}>
            <Text style={styles.spotTitle}>{spot.title}</Text>
            <RatingStars rating={spot.rating} count={spot.reviewCount} />
          </View>

          {/* Photos */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.photos')}</Text>
            <View style={styles.photosRow}>
              {photos.map((url, index) => (
                <View key={url} style={styles.photoThumbWrapper}>
                  <Image source={{ uri: url }} style={styles.photoThumb} />
                  {index === 0 ? (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>{t('owner.spot.new.cover')}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.setCoverBtn}
                      disabled={photosBusy}
                      onPress={() => handleSetCover(url)}
                    >
                      <Ionicons name="star-outline" size={11} color={colors.white} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    disabled={photosBusy}
                    onPress={() => handleDeletePhoto(url)}
                  >
                    <Ionicons name="close" size={13} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoThumb} disabled={photosBusy} onPress={pickAndUploadPhotos}>
                  {photosBusy ? (
                    <ActivityIndicator color={colors.teal} size="small" />
                  ) : (
                    <Ionicons name="add" size={22} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Location */}
          <View style={[styles.card, styles.locationCard]}>
            <Text style={styles.sectionLabel}>{t('owner.spot.new.address')}</Text>
            <View style={styles.addressRow}>
              <AddressAutocomplete
                value={address}
                onChangeText={handleAddressChange}
                onSelect={selectAddress}
                placeholder={t('owner.spot.new.addressPlaceholder')}
                onSuggestionsVisibilityChange={setAddressSuggestionsOpen}
              />
              <TouchableOpacity
                style={styles.locateButton}
                onPress={useCurrentLocation}
                disabled={locating}
                accessibilityLabel={t('owner.spot.new.useCurrentLocation')}
              >
                {locating ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Ionicons name="locate" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
            {coordinates && !addressSuggestionsOpen && (
              <View style={styles.locationConfirmedRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.locationConfirmed}>{t('owner.spot.new.locationConfirmed')}</Text>
              </View>
            )}
            {locationError && !addressSuggestionsOpen && <Text style={styles.locationError}>{locationError}</Text>}
          </View>

          {/* Price */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.pricePerHour')}</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="1200"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Capacity */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.new.capacity')}</Text>
            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={(text) => setCapacity(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {t('owner.spot.new.capacityHint')}
            </Text>
          </View>

          {/* Type */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.new.type')}</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggle, covered && styles.toggleActive]}
                onPress={() => setCovered(true)}
              >
                <Text style={covered ? styles.toggleTextActive : styles.toggleText}>
                  {t('owner.spot.new.covered')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, !covered && styles.toggleActive]}
                onPress={() => setCovered(false)}
              >
                <Text style={!covered ? styles.toggleTextActive : styles.toggleText}>
                  {t('owner.spot.new.uncovered')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Instant booking */}
          <View style={styles.card}>
            <View style={styles.instantBookingRow}>
              <View style={styles.instantBookingLabelBlock}>
                <Text style={styles.sectionLabel}>{t('owner.spot.new.instantBooking')}</Text>
                <Text style={styles.instantBookingHint}>{t('owner.spot.new.instantBookingHint')}</Text>
              </View>
              <Switch value={instantBooking} onValueChange={setInstantBooking} trackColor={{ true: colors.teal }} />
            </View>
          </View>

          {/* Availability */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.availability')}</Text>
            <AvailabilityPicker value={schedule} onChange={setSchedule} />
          </View>

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.description')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder={t('owner.spot.new.descriptionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Button
            title={saving ? t('owner.spot.edit.saving') : t('owner.spot.edit.save')}
            onPress={save}
            disabled={saving}
            style={styles.saveBtn}
          />

          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleToggleActive}
            disabled={statusBusy}
          >
            {statusBusy ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.dangerBtnText}>
                {spot.active ? t('owner.spot.edit.deactivate') : t('owner.spot.edit.reactivate')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerBtn, styles.deleteBtn]}
            onPress={handleDelete}
            disabled={deleteBusy}
          >
            {deleteBusy ? (
              <ActivityIndicator color="#C62828" size="small" />
            ) : (
              <Text style={[styles.dangerBtnText, styles.deleteBtnText]}>{t('owner.spot.edit.delete')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <TouchableWithoutFeedback onPress={() => setConfirmModal(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{confirmModal?.title}</Text>
                <Text style={styles.modalBody}>{confirmModal?.body}</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [styles.modalCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => setConfirmModal(null)}
                  >
                    <Text style={styles.modalCancelBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.modalConfirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                    onPress={() => {
                      const onConfirm = confirmModal?.onConfirm;
                      setConfirmModal(null);
                      onConfirm?.();
                    }}
                  >
                    <Text style={styles.modalConfirmBtnText}>{confirmModal?.confirmLabel}</Text>
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
