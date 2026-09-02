import { useState } from 'react';
import { View, Text, TextInput, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Image } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { AvailabilityPicker, DayScheduleGroup, dayGroupsToEntries } from '@/src/components/AvailabilityPicker';
import { AddressAutocomplete } from '@/src/components/AddressAutocomplete';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { createParkingSpot, uploadParkingSpotPhotos } from '@/src/services/parkingService';
import { GeocodeCandidate, ParkingSpotPhotoAsset, reverseGeocode } from '@/src/api/parking';
import { t, useLanguage } from '@/src/i18n';

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Default Mon–Fri, 08:00–20:00 */
const DEFAULT_SCHEDULE: DayScheduleGroup[] = [0, 1, 2, 3, 4].map((dayIndex) => ({
  dayIndex,
  slots: [{ startHour: 8, endHour: 20 }],
}));

export default function NewSpot() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const user = useSessionStore((s) => s.user);

  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [covered, setCovered] = useState(true);
  const [price, setPrice] = useState('');
  const [schedule, setSchedule] = useState<DayScheduleGroup[]>(DEFAULT_SCHEDULE);
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
    if (!user || !address.trim() || !coordinates || !price.trim()) {
      alert(t('owner.spot.new.requiredFields'));
      return;
    }
    if (schedule.length === 0) {
      alert(t('owner.spot.new.requiredSchedule'));
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
        pricePerHour: Number(price),
        schedule: dayGroupsToEntries(schedule),
        description: description.trim() || undefined,
      });
      if (photos.length > 0) {
        // La cochera ya existe -- si esto falla, el dueño todavía puede
        // agregar fotos después desde la edición, así que no bloqueamos la
        // publicación por un error acá.
        await uploadParkingSpotPhotos(spot.id, photos).catch(() => {});
      }
      router.back();
    } catch {
      alert(t('owner.spot.new.errorPublish'));
      setPublishing(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    scroll: { padding: 16, gap: 8, paddingBottom: 40 },

    photoBox: {
      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
      borderRadius: 10, height: 90,
      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    photoPlus: { fontSize: 24, color: colors.textSecondary },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
    addPhotoThumb: {
      width: 72, height: 72, borderRadius: 8,
      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },

    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, fontSize: 15, marginBottom: 4, color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },

    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    toggle: {
      flex: 1, borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    },
    toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toggleText: { color: colors.text },
    toggleTextActive: { color: colors.white, fontWeight: '600' },

    sectionLabel: { marginBottom: 4 },
    button: { marginTop: 16 },

    addressRow: { flexDirection: 'row', gap: 8, marginBottom: 4, zIndex: 20, elevation: 20 },
    locateButton: {
      width: 46, height: 46, borderRadius: 8,
      backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    },
    locationConfirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    locationConfirmed: { color: colors.success, fontSize: 12, fontWeight: '700' },
    locationError: { color: '#C62828', fontSize: 12, marginBottom: 8 },
  });

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={typography.caption}>{t('owner.spot.new.photos')}</Text>
        {photos.length === 0 ? (
          <Pressable style={styles.photoBox} onPress={pickPhotos}>
            <Text style={styles.photoPlus}>+</Text>
            <Text style={typography.caption}>{t('owner.spot.new.photosTap')}</Text>
          </Pressable>
        ) : (
          <View style={styles.photoRow}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.photoThumbWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                {index === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>{t('owner.spot.new.cover')}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(index)}>
                  <Ionicons name="close" size={13} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity style={styles.addPhotoThumb} onPress={pickPhotos}>
                <Text style={styles.photoPlus}>+</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={typography.caption}>{t('owner.spot.new.address')}</Text>
        <View style={styles.addressRow}>
          <AddressAutocomplete
            value={address}
            onChangeText={handleAddressChange}
            onSelect={selectAddress}
            placeholder={t('owner.spot.new.addressPlaceholder')}
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
        {coordinates && (
          <View style={styles.locationConfirmedRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.locationConfirmed}>{t('owner.spot.new.locationConfirmed')}</Text>
          </View>
        )}
        {locationError && <Text style={styles.locationError}>{locationError}</Text>}

        <Text style={typography.caption}>{t('owner.spot.new.type')}</Text>
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

        <Text style={typography.caption}>{t('owner.spot.new.pricePerHour')}</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          placeholder="$1.200"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[typography.caption, styles.sectionLabel]}>
          {t('owner.spot.new.availability')}
        </Text>
        <AvailabilityPicker value={schedule} onChange={setSchedule} />

        <Text style={typography.caption}>{t('owner.spot.new.description')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder={t('owner.spot.new.descriptionPlaceholder')}
          placeholderTextColor={colors.textSecondary}
        />

        <Button
          title={publishing ? t('owner.spot.new.publishing') : t('owner.spot.new.publish')}
          onPress={publish}
          disabled={publishing}
          style={styles.button}
        />
      </ScrollView>
    </Screen>
  );
}
