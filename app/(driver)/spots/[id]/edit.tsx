import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Image, TouchableOpacity, ActivityIndicator, Modal, TouchableWithoutFeedback,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect, useSegments } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { RatingStars } from '@/src/components/RatingStars';
import { dayGroupsToEntries, entriesToDayGroups } from '@/src/components/AvailabilityPicker';
import { AddressAutocomplete } from '@/src/components/AddressAutocomplete';
import { StaySettingsEditor, StaySettingsFormValue, EMPTY_STAY_SETTINGS } from '@/src/components/StaySettingsEditor';
import {
  HourlySettingsEditor,
  HourlySettingsFormValue,
  EMPTY_HOURLY_SETTINGS,
  isHourlyPricingValid,
  hourlyPricesByVehicleTypeToNumbers,
} from '@/src/components/HourlySettingsEditor';
import { VehicleTypePicker } from '@/src/components/VehicleTypePicker';
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
import { VehicleType } from '@/src/constants/vehicleTypes';
import { t, useLanguage } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditSpot() {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const markUpdated = useSpotsStore((s) => s.markUpdated);
  const clearSpots = useSpotsStore((s) => s.clearSpots);

  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressSuggestionsOpen, setAddressSuggestionsOpen] = useState(false);
  const [capacity, setCapacity] = useState('1');
  const [description, setDescription] = useState('');
  const [covered, setCovered] = useState(true);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [hourlySettings, setHourlySettings] = useState<HourlySettingsFormValue>(EMPTY_HOURLY_SETTINGS);
  const [staySettings, setStaySettings] = useState<StaySettingsFormValue>(EMPTY_STAY_SETTINGS);
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
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    getParkingSpotDetail(id)
      .then((s) => {
        if (!s) return;
        setSpot(s);
        setAddress(s.address);
        setCoordinates({ lat: s.lat, lng: s.lng });
        setCapacity(String(s.capacity ?? 1));
        setDescription(s.description ?? '');
        setCovered(s.covered);
        setVehicleTypes(s.vehicleTypes);
        setPhotos(s.photos);
        setHourlySettings({
          hourlyEnabled: s.hourlyEnabled,
          pricePerHour: s.pricePerHour !== null ? String(s.pricePerHour) : '',
          pricePerVehicleType: s.pricePerHourByVehicleType !== null,
          pricePerHourByVehicleType: Object.fromEntries(
            Object.entries(s.pricePerHourByVehicleType ?? {}).map(([vt, price]) => [vt, String(price)]),
          ),
          schedule: s.schedule.length > 0 ? entriesToDayGroups(s.schedule) : [],
        });
        setStaySettings({
          stayEnabled: s.stayEnabled,
          pricePerDay: s.pricePerDay !== null ? String(s.pricePerDay) : '',
          pricePerWeek: s.pricePerWeek !== null ? String(s.pricePerWeek) : '',
          pricePerMonth: s.pricePerMonth !== null ? String(s.pricePerMonth) : '',
          maxStayDays: s.maxStayDays !== null ? String(s.maxStayDays) : '',
          stayAvailableFrom: s.stayAvailableFrom ?? '',
          stayAvailableUntil: s.stayAvailableUntil ?? '',
        });
      })
      .catch((err) => {
        console.warn('[EditSpot] fetch error:', err);
        setLoadError(true);
      });
  }, [id]);

  useFocusEffect(load);

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

  if (loadError) {
    // Estilos inline, no del StyleSheet de más abajo (const styles, línea
    // ~361): ese está declarado después de este return en el cuerpo del
    // componente y referenciarlo acá rompería con "Cannot access before
    // initialization" (temporal dead zone de `const`).
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <Text style={{ color: colors.text, fontSize: sc(15), textAlign: 'center' }}>
            {t('owner.spot.edit.errorLoad')}
          </Text>
          <Button title={t('common.retry')} onPress={load} />
        </View>
      </Screen>
    );
  }

  if (!spot) return null;

  async function save() {
    if (!hourlySettings.hourlyEnabled && !staySettings.stayEnabled) {
      alert(t('owner.spot.new.requiredMode'));
      return;
    }
    if (vehicleTypes.length === 0) {
      alert(t('owner.spot.new.requiredVehicleTypes'));
      return;
    }
    if (hourlySettings.hourlyEnabled && hourlySettings.schedule.length === 0) {
      alert(t('owner.spot.edit.invalidHours'));
      return;
    }
    if (!isHourlyPricingValid(hourlySettings, vehicleTypes)) {
      alert(t('owner.spot.edit.invalidPrice'));
      return;
    }
    if (!address.trim() || !coordinates) {
      alert(t('owner.spot.new.requiredFields'));
      return;
    }
    if (
      staySettings.stayEnabled &&
      (!staySettings.pricePerDay.trim() ||
        !staySettings.pricePerWeek.trim() ||
        !staySettings.pricePerMonth.trim() ||
        !staySettings.maxStayDays.trim())
    ) {
      alert(t('owner.spot.stay.requiredFields'));
      return;
    }
    try {
      setSaving(true);
      await updateParkingSpot(id, {
        hourlyEnabled: hourlySettings.hourlyEnabled,
        pricePerHour:
          hourlySettings.hourlyEnabled && !hourlySettings.pricePerVehicleType
            ? Number(hourlySettings.pricePerHour)
            : undefined,
        // `null` explícito borra un mapa anterior si el dueño volvió a
        // precio único -- omitir el campo (undefined) dejaría el mapa viejo
        // vigente en la DB aunque el toggle esté apagado acá.
        pricePerHourByVehicleType: hourlySettings.hourlyEnabled
          ? (hourlySettings.pricePerVehicleType ? hourlyPricesByVehicleTypeToNumbers(hourlySettings, vehicleTypes) : null)
          : undefined,
        description: description.trim(),
        covered,
        vehicleTypes,
        capacity: Math.max(1, Math.trunc(Number(capacity)) || 1),
        schedule: hourlySettings.hourlyEnabled ? dayGroupsToEntries(hourlySettings.schedule) : [],
        address: address.trim(),
        lat: coordinates.lat,
        lng: coordinates.lng,
        stayEnabled: staySettings.stayEnabled,
        pricePerDay: staySettings.stayEnabled ? Number(staySettings.pricePerDay) : undefined,
        pricePerWeek: staySettings.stayEnabled ? Number(staySettings.pricePerWeek) : undefined,
        pricePerMonth: staySettings.stayEnabled ? Number(staySettings.pricePerMonth) : undefined,
        maxStayDays: staySettings.stayEnabled ? Number(staySettings.maxStayDays) : undefined,
        stayAvailableFrom: staySettings.stayEnabled ? (staySettings.stayAvailableFrom.trim() || undefined) : undefined,
        stayAvailableUntil: staySettings.stayEnabled ? (staySettings.stayAvailableUntil.trim() || undefined) : undefined,
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
          router.replace(`${group}/(tabs)/profile`);
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
    spotTitle: { fontSize: sc(18), fontWeight: '700', color: colors.text },
    spotAddress: { fontSize: sc(13), color: colors.textSecondary },

    // Misma tipografía que el label interno de HourlySettingsEditor/
    // StaySettingsEditor ("Alquiler por hora"/"Estadía") -- el usuario pidió
    // que todos los títulos de sección del formulario luzcan igual a esos.
    sectionLabel: {
      fontSize: sc(13), fontWeight: '600', color: colors.text, marginBottom: 4,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },

    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 12, fontSize: sc(15), color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },

    toggleRow: { flexDirection: 'row', gap: 8 },
    toggle: {
      flex: 1, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    },
    toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toggleText: { fontSize: sc(14), fontWeight: '600', color: colors.textSecondary },
    toggleTextActive: { color: colors.surface, fontWeight: '700' },

    photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoThumbWrapper: { position: 'relative' },
    photoThumb: { width: 72, height: 72, borderRadius: 8 },
    coverBadge: {
      position: 'absolute', bottom: 2, left: 2,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4,
      paddingHorizontal: 4, paddingVertical: 1,
    },
    coverBadgeText: { color: colors.white, fontSize: sc(9), fontWeight: '700' },
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
    locationConfirmed: { color: colors.success, fontSize: sc(12), fontWeight: '700' },
    locationError: { color: '#C62828', fontSize: sc(12) },

    saveBtn: { marginTop: 4 },
    dangerBtn: {
      marginTop: 4, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 13, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border,
    },
    dangerBtnText: { fontWeight: '700', fontSize: sc(15), color: colors.text },
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
      fontSize: sc(16), fontWeight: '700', color: colors.text,
      marginBottom: 8, textAlign: 'center',
    },
    modalBody: {
      fontSize: sc(13), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(18),
      marginBottom: 8,
    },
    modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
    modalCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    modalConfirmBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      backgroundColor: '#C62828',
    },
    modalConfirmBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                      <Ionicons name="star-outline" size={sc(11)} color={colors.white} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    disabled={photosBusy}
                    onPress={() => handleDeletePhoto(url)}
                  >
                    <Ionicons name="close" size={sc(13)} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoThumb} disabled={photosBusy} onPress={pickAndUploadPhotos}>
                  {photosBusy ? (
                    <ActivityIndicator color={colors.teal} size="small" />
                  ) : (
                    <Ionicons name="add" size={sc(22)} color={colors.textSecondary} />
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
                  <Ionicons name="locate" size={sc(20)} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
            {coordinates && !addressSuggestionsOpen && (
              <View style={styles.locationConfirmedRow}>
                <Ionicons name="checkmark-circle" size={sc(14)} color={colors.success} />
                <Text style={styles.locationConfirmed}>{t('owner.spot.new.locationConfirmed')}</Text>
              </View>
            )}
            {locationError && !addressSuggestionsOpen && <Text style={styles.locationError}>{locationError}</Text>}
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
            <Text style={{ fontSize: sc(12), color: colors.textSecondary }}>
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

          {/* Vehicle types */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.new.vehicleTypes')}</Text>
            <VehicleTypePicker value={vehicleTypes} onChange={setVehicleTypes} />
          </View>

          {/* Alquiler por hora */}
          <View style={styles.card}>
            <HourlySettingsEditor
              value={hourlySettings}
              onChange={(patch) => setHourlySettings((prev) => ({ ...prev, ...patch }))}
              vehicleTypes={vehicleTypes}
            />
          </View>

          {/* Estadía */}
          <View style={styles.card}>
            <StaySettingsEditor
              value={staySettings}
              onChange={(patch) => setStaySettings((prev) => ({ ...prev, ...patch }))}
            />
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
