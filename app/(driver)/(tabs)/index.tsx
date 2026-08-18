import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Chip } from '@/src/components/Chip';
import { Button } from '@/src/components/Button';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { AccountMenu } from '@/src/components/AccountMenu';
import { Screen } from '@/src/components/Screen';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useSessionStore } from '@/src/store/useSessionStore';
import { searchParkingSpots, SearchParkingSpotsFilters } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const DISTANCE_OPTIONS = [
  { label: '< 500 m', value: 500 },
  { label: '< 1 km', value: 1000 },
  { label: '< 2 km', value: 2000 },
];

function pinPosition(id: string): { top: `${number}%`; left: `${number}%` } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  const top = 10 + (hash % 65);
  const left = 8 + ((hash * 7) % 75);
  return { top: `${top}%`, left: `${left}%` };
}

export default function Search() {
  const colors = useThemeColors();
  const typography = useTypography();
  const mode = useSettingsStore((s) => s.mode);
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [filters, setFilters] = useState<SearchParkingSpotsFilters>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [distanceInput, setDistanceInput] = useState<number | undefined>(undefined);

  async function locateMe() {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Necesitamos tu ubicación para mostrarte cocheras cerca tuyo.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      setLocationError('No pudimos obtener tu ubicación. Probá de nuevo.');
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    locateMe();
  }, []);

  useEffect(() => {
    if (!location) return;
    searchParkingSpots({ ...filters, lat: location.lat, lng: location.lng }).then((results) => {
      setSpots(results);
      setSelectedSpotId(results[0]?.id ?? null);
    });
  }, [filters, location]);

  function openFilters() {
    setMinPriceInput(filters.minPrice ? String(filters.minPrice) : '');
    setMaxPriceInput(filters.maxPrice ? String(filters.maxPrice) : '');
    setCoveredOnly(filters.covered ?? false);
    setDistanceInput(filters.maxDistanceMeters);
    setModalVisible(true);
  }

  function applyFilters() {
    setFilters({
      minPrice: minPriceInput ? Number(minPriceInput) : undefined,
      maxPrice: maxPriceInput ? Number(maxPriceInput) : undefined,
      covered: coveredOnly || undefined,
      maxDistanceMeters: distanceInput,
    });
    setModalVisible(false);
  }

  function clearFilters() {
    setFilters({});
    setModalVisible(false);
  }

  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    activeChips.push({
      label: `$${filters.minPrice ?? 0} – ${filters.maxPrice ?? '∞'}`,
      onRemove: () => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined })),
    });
  }
  if (filters.covered) {
    activeChips.push({
      label: 'Cubierta',
      onRemove: () => setFilters((f) => ({ ...f, covered: undefined })),
    });
  }
  if (filters.maxDistanceMeters !== undefined) {
    activeChips.push({
      label: DISTANCE_OPTIONS.find((d) => d.value === filters.maxDistanceMeters)?.label ?? '',
      onRemove: () => setFilters((f) => ({ ...f, maxDistanceMeters: undefined })),
    });
  }

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerLogo: { width: 36, height: 27 },
    headerGreeting: { flex: 1 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
    locationBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    locationText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
    locationButton: {
      backgroundColor: colors.teal,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    locationButtonText: { color: colors.white, fontWeight: '600', fontSize: 13 },
    error: { color: '#C62828', fontSize: 13 },
    mapWrapper: { flex: 1, gap: 10 },
    mapBackground: {
      flex: 1,
      backgroundColor: mode === 'dark' ? '#16233A' : '#D6E8F5',
      borderRadius: 12,
      overflow: 'hidden',
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(4, 35, 71, 0.08)',
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(4, 35, 71, 0.08)',
    },
    pin: {
      position: 'absolute',
      backgroundColor: colors.deepNavy,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pinSelected: {
      backgroundColor: colors.warning,
    },
    pinText: { color: colors.white, fontSize: 12, fontWeight: '700' },
    pinTextSelected: { color: colors.white },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.4)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      maxHeight: '85%',
    },
    sectionTitle: { marginTop: 12, marginBottom: 4 },
    row: { flexDirection: 'row', gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    halfInput: { flex: 1 },
    applyButton: { marginTop: 16 },
    clearLink: { color: colors.teal, textAlign: 'center', marginTop: 12 },
  });

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <Image
          source={require('@/assets/logo-parklink.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={[typography.h1, styles.headerGreeting]}>Hola, {user?.name}</Text>
        <AccountMenu role="driver" />
      </View>

      <View style={styles.locationBar}>
        <Text style={styles.locationText}>
          {location
            ? '📍 Buscando cocheras cerca de tu ubicación'
            : locationError ?? 'Buscando tu ubicación…'}
        </Text>
        <TouchableOpacity style={styles.locationButton} onPress={locateMe} disabled={locating}>
          {locating ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.locationButtonText}>Actualizar</Text>
          )}
        </TouchableOpacity>
      </View>
      {locationError ? <Text style={styles.error}>{locationError}</Text> : null}

      <View style={styles.filterRow}>
        <Chip label="⚙ Filtros" selected={activeChips.length > 0} onPress={openFilters} />
        {activeChips.map((chip) => (
          <Chip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
        ))}
      </View>

      <View style={styles.filterRow}>
        <Chip label="☰ Lista" selected={viewMode === 'list'} onPress={() => setViewMode('list')} />
        <Chip label="🗺 Mapa" selected={viewMode === 'map'} onPress={() => setViewMode('map')} />
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push({
              pathname: `/(driver)/spot/${item.id}`,
              params: { startHour: '8', endHour: '9' },
            })}>
              <ParkingSpotCard spot={item} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.mapWrapper}>
          <View style={styles.mapBackground}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={`h-${i}`} style={[styles.gridLineH, { top: `${i * 16}%` }]} />
            ))}
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={`v-${i}`} style={[styles.gridLineV, { left: `${i * 16}%` }]} />
            ))}
            {spots.map((spot) => {
              const pos = pinPosition(spot.id);
              const isSelected = spot.id === selectedSpotId;
              return (
                <TouchableOpacity
                  key={spot.id}
                  style={[styles.pin, { top: pos.top, left: pos.left }, isSelected && styles.pinSelected]}
                  onPress={() => setSelectedSpotId(spot.id)}
                >
                  <Text style={[styles.pinText, isSelected && styles.pinTextSelected]}>
                    ${getDriverVisiblePrice(spot.pricePerHour)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedSpot && (
            <TouchableOpacity onPress={() => router.push({
              pathname: `/(driver)/spot/${selectedSpot.id}`,
              params: { startHour: '8', endHour: '9' },
            })}>
              <ParkingSpotCard spot={selectedSpot} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={typography.h1}>Filtros</Text>

              <Text style={[typography.caption, styles.sectionTitle]}>PRECIO POR HORA</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Mínimo"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={minPriceInput}
                  onChangeText={setMinPriceInput}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Máximo"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={maxPriceInput}
                  onChangeText={setMaxPriceInput}
                />
              </View>

              <Text style={[typography.caption, styles.sectionTitle]}>TIPO</Text>
              <Chip
                label={coveredOnly ? '🏠 Solo cubiertas' : '🏠 Cubierta y descubierta'}
                selected={coveredOnly}
                onPress={() => setCoveredOnly((v) => !v)}
              />

              <Text style={[typography.caption, styles.sectionTitle]}>DISTANCIA</Text>
              <View style={styles.filterRow}>
                {DISTANCE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={distanceInput === option.value}
                    onPress={() =>
                      setDistanceInput((current) => (current === option.value ? undefined : option.value))
                    }
                  />
                ))}
              </View>

              <Button title="Aplicar filtros" onPress={applyFilters} style={styles.applyButton} />
              <Text style={styles.clearLink} onPress={clearFilters}>
                Limpiar filtros
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
