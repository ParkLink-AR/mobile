import { useState } from 'react';
import { View, Text, TextInput, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Image } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { dayGroupsToEntries } from '@/src/components/AvailabilityPicker';
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
import { useSessionStore } from '@/src/store/useSessionStore';
import { createParkingSpot, uploadParkingSpotPhotos } from '@/src/services/parkingService';
import { ApiError } from '@/src/api/client';
import { GeocodeCandidate, ParkingSpotPhotoAsset, reverseGeocode } from '@/src/api/parking';
import { VehicleType } from '@/src/constants/vehicleTypes';
import { t, useLanguage } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function NewSpot() {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  useLanguage();
  const user = useSessionStore((s) => s.user);

  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressSuggestionsOpen, setAddressSuggestionsOpen] = useState(false);
  const [covered, setCovered] = useState(true);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [capacity, setCapacity] = useState('1');
  const [hourlySettings, setHourlySettings] = useState<HourlySettingsFormValue>(EMPTY_HOURLY_SETTINGS);
  const [staySettings, setStaySettings] = useState<StaySettingsFormValue>(EMPTY_STAY_SETTINGS);
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [photos, setPhotos] = useState<ParkingSpotPhotoAsset[]>([]);

  async function pickPhotos() {
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

    const picked: ParkingSpotPhotoAsset[] = [];
    for (const asset of result.assets) {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) continue;
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) continue;
      picked.push({
        uri: asset.uri,
        name: asset.fileName ?? `photo.${mimeType.split('/')[1]}`,
        type: mimeType,
      });
    }
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function selectAddress(candidate: GeocodeCandidate) {
    setAddress(candidate.displayName);
    setCoordinates({ lat: candidate.lat, lng: candidate.lng });
    setLocationError(null);
  }

  function handleAddressChange(text: string) {
    setAddress(text);
    // Editing the text after picking one invalidates the coordinates it
    // came with -- force picking (or GPS) again before publishing.
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
        // Coordinates are still good even if we couldn't turn them into a
        // readable label -- fall back to a generic one instead of blocking.
        setAddress(t('owner.spot.new.locationFallback'));
      }
    } catch {
      setLocationError(t('search.location.error'));
    } finally {
      setLocating(false);
    }
  }

  async function publish() {
    if (!user || !address.trim() || !coordinates) {
      alert(t('owner.spot.new.requiredFields'));
      return;
    }
    if (!hourlySettings.hourlyEnabled && !staySettings.stayEnabled) {
      alert(t('owner.spot.new.requiredMode'));
      return;
    }
    if (vehicleTypes.length === 0) {
      alert(t('owner.spot.new.requiredVehicleTypes'));
      return;
    }
    if (!isHourlyPricingValid(hourlySettings, vehicleTypes)) {
      alert(t('owner.spot.new.requiredFields'));
      return;
    }
    if (hourlySettings.hourlyEnabled && hourlySettings.schedule.length === 0) {
      alert(t('owner.spot.new.requiredSchedule'));
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
      setPublishing(true);
      const spot = await createParkingSpot({
        title: address.split(',')[0] || address,
        address: address.trim(),
        lat: coordinates.lat,
        lng: coordinates.lng,
        covered,
        vehicleTypes,
        hourlyEnabled: hourlySettings.hourlyEnabled,
        pricePerHour:
          hourlySettings.hourlyEnabled && !hourlySettings.pricePerVehicleType
            ? Number(hourlySettings.pricePerHour)
            : undefined,
        pricePerHourByVehicleType:
          hourlySettings.hourlyEnabled && hourlySettings.pricePerVehicleType
            ? hourlyPricesByVehicleTypeToNumbers(hourlySettings, vehicleTypes)
            : undefined,
        capacity: Math.max(1, Math.trunc(Number(capacity)) || 1),
        schedule: hourlySettings.hourlyEnabled ? dayGroupsToEntries(hourlySettings.schedule) : undefined,
        description: description.trim() || undefined,
        stayEnabled: staySettings.stayEnabled,
        pricePerDay: staySettings.stayEnabled ? Number(staySettings.pricePerDay) : undefined,
        pricePerWeek: staySettings.stayEnabled ? Number(staySettings.pricePerWeek) : undefined,
        pricePerMonth: staySettings.stayEnabled ? Number(staySettings.pricePerMonth) : undefined,
        maxStayDays: staySettings.stayEnabled ? Number(staySettings.maxStayDays) : undefined,
        stayAvailableFrom: staySettings.stayEnabled ? (staySettings.stayAvailableFrom.trim() || undefined) : undefined,
        stayAvailableUntil: staySettings.stayEnabled ? (staySettings.stayAvailableUntil.trim() || undefined) : undefined,
      });
      if (photos.length > 0) {
        // La cochera ya existe -- si esto falla no bloqueamos la publicación,
        // pero sí avisamos: el dueño puede agregar las fotos después desde la
        // edición, y no tiene que creer que se subieron.
        try {
          await uploadParkingSpotPhotos(spot.id, photos);
        } catch {
          alert(t('owner.spot.new.photosUploadFailed'));
        }
      }
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.detail === 'PAYOUT_INFO_REQUIRED') {
        alert(t('owner.spot.new.errorPayoutInfoRequired'));
        setPublishing(false);
        router.push('/(owner)/payout-info');
        return;
      }
      alert(t('owner.spot.new.errorPublish'));
      setPublishing(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },

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

    publishBtn: { marginTop: 4 },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.body}>
          {/* Photos */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.new.photos')}</Text>
            <View style={styles.photosRow}>
              {photos.map((photo, index) => (
                <View key={photo.uri} style={styles.photoThumbWrapper}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  {index === 0 && (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>{t('owner.spot.new.cover')}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(index)}>
                    <Ionicons name="close" size={sc(13)} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoThumb} onPress={pickPhotos}>
                  <Ionicons name="add" size={sc(22)} color={colors.textSecondary} />
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
            <Text style={styles.sectionLabel}>{t('owner.spot.new.description')}</Text>
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
            title={publishing ? t('owner.spot.new.publishing') : t('owner.spot.new.publish')}
            onPress={publish}
            disabled={publishing}
            style={styles.publishBtn}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
