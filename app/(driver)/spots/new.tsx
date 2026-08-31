import { useState } from 'react';
import { View, Text, TextInput, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { AvailabilityPicker, DayScheduleGroup, dayGroupsToEntries } from '@/src/components/AvailabilityPicker';
import { AddressAutocomplete } from '@/src/components/AddressAutocomplete';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { createParkingSpot } from '@/src/services/parkingService';
import { GeocodeCandidate, reverseGeocode } from '@/src/api/parking';
import { t, useLanguage } from '@/src/i18n';

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
      await createParkingSpot({
        title: address.split(',')[0] || address,
        address: address.trim(),
        lat: coordinates.lat,
        lng: coordinates.lng,
        covered,
        pricePerHour: Number(price),
        schedule: dayGroupsToEntries(schedule),
        description: description.trim() || undefined,
      });
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
    locationConfirmed: { color: colors.success, fontSize: 12, fontWeight: '700', marginBottom: 8 },
    locationError: { color: '#C62828', fontSize: 12, marginBottom: 8 },
  });

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={typography.caption}>{t('owner.spot.new.photos')}</Text>
        <Pressable style={styles.photoBox}>
          <Text style={styles.photoPlus}>+</Text>
          <Text style={typography.caption}>{t('owner.spot.new.photosTap')}</Text>
        </Pressable>

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
        {coordinates && <Text style={styles.locationConfirmed}>{t('owner.spot.new.locationConfirmed')}</Text>}
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
