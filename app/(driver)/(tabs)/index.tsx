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
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { Button } from '@/src/components/Button';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { AccountMenu } from '@/src/components/AccountMenu';
import { Screen } from '@/src/components/Screen';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useSessionStore } from '@/src/store/useSessionStore';
import { searchParkingSpots, SearchParkingSpotsFilters } from '@/src/services/parkingService';
import { geocodeAddress, GeocodeCandidate } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

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
  useLanguage();
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

  const [addressQuery, setAddressQuery] = useState('');
  const [searchAddress, setSearchAddress] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [distanceInput, setDistanceInput] = useState<number | undefined>(undefined);

  async function locateMe() {
    // Switching to GPS overrides any active address search.
    setSearchAddress(null);
    setAddressQuery('');
    setAddressError(null);
    setCandidates([]);
    setShowSuggestions(false);

    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(t('search.location.permissionError'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      setLocationError(t('search.location.error'));
    } finally {
      setLocating(false);
    }
  }

  // Live suggestions as you type, like any other address search (Google
  // Maps, Uber, etc.) -- debounced so it doesn't fire a request per
  // keystroke, and only once there's enough text to actually search with.
  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 3) {
      setCandidates([]);
      setShowSuggestions(false);
      setAddressError(null);
      return;
    }

    const timer = setTimeout(() => {
      setGeocoding(true);
      geocodeAddress(query)
        .then((results) => {
          setCandidates(results);
          setShowSuggestions(true);
          setAddressError(results.length === 0 ? t('search.location.addressError') : null);
        })
        .catch((err) => {
          setCandidates([]);
          setShowSuggestions(true);
          setAddressError(err instanceof ApiError ? err.detail : t('search.location.addressError'));
        })
        .finally(() => setGeocoding(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [addressQuery]);

  function selectCandidate(candidate: GeocodeCandidate) {
    setShowSuggestions(false);
    setCandidates([]);
    setSearchAddress(candidate.displayName);
    setLocation({ lat: candidate.lat, lng: candidate.lng });
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
  if (searchAddress) {
    activeChips.push({
      label: t('search.nearBy', { address: searchAddress }),
      onRemove: () => locateMe(),
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    activeChips.push({
      label: `$${filters.minPrice ?? 0} – ${filters.maxPrice ?? '∞'}`,
      onRemove: () => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined })),
    });
  }
  if (filters.covered) {
    activeChips.push({
      label: t('search.filters.coveredOnly'),
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
  const hasActiveFilters = activeChips.length > 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLogo: { width: 28, height: 28 },
    headerGreetingBlock: { flex: 1 },
    headerGreetingLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '400',
      letterSpacing: 0.2,
    },
    headerGreetingName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    // ── Search bar (address, or fall back to device location) ──────────────
    searchWrapper: {
      position: 'relative',
      zIndex: 20,
      elevation: 20,
    },
    searchSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionsDropdown: {
      position: 'absolute',
      top: '100%',
      left: 20,
      right: 20,
      maxHeight: 320,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    candidateEmpty: {
      paddingVertical: 16,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    searchInputWrapper: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      color: colors.text,
      height: '100%',
    },
    locateButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      paddingHorizontal: 20,
      paddingTop: 8,
      color: colors.textSecondary,
      fontSize: 13,
      backgroundColor: colors.surface,
    },
    error: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
      color: '#C62828',
      fontSize: 13,
      backgroundColor: colors.surface,
    },
    // ── Toolbar (filters + view toggle) ─────────────────────────────────────
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: hasActiveFilters ? colors.teal : colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: hasActiveFilters ? colors.teal + '12' : colors.surface,
    },
    filterButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: hasActiveFilters ? colors.teal : colors.textSecondary,
    },
    filterBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
    },
    spacer: { flex: 1 },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 2,
    },
    segmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: colors.teal,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.white,
    },
    // ── Active filter chips ──────────────────────────────────────────────────
    activeFiltersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 4,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // ── List content ────────────────────────────────────────────────────────
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 120,
    },
    // ── Map view ────────────────────────────────────────────────────────────
    mapWrapper: {
      flex: 1,
      gap: 0,
    },
    mapBackground: {
      flex: 1,
      backgroundColor: mode === 'dark' ? '#16233A' : '#D6E8F5',
      overflow: 'hidden',
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor:
        mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(4, 35, 71, 0.06)',
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor:
        mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(4, 35, 71, 0.06)',
    },
    pin: {
      position: 'absolute',
      backgroundColor: colors.deepNavy,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    pinSelected: { backgroundColor: colors.teal },
    pinText: { color: colors.white, fontSize: 12, fontWeight: '700' },
    mapCardWrapper: {
      padding: 16,
      paddingBottom: 0,
    },
    // ── Filter modal ─────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.45)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingTop: 12,
      maxHeight: '88%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', gap: 10 },
    input: {
      flex: 1,
      // Without this, react-native-web's <input> keeps its content-based
      // intrinsic width as a flex-shrink floor, so it doesn't actually
      // shrink to share the row evenly -- one box ends up oversized and
      // shoves the other one past the edge of the screen.
      minWidth: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    applyButton: { marginTop: 20, marginBottom: 6 },
    clearLink: {
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 4,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    // ── Address picker ───────────────────────────────────────────────────
    candidateRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    candidateMain: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, lineHeight: 19 },
  });

  return (
    <Screen style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/favicon.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerGreetingBlock}>
          <Text style={styles.headerGreetingLabel}>{t('search.welcome')}</Text>
          <Text style={styles.headerGreetingName}>{user?.name ?? ''}</Text>
        </View>
        <AccountMenu role="driver" />
      </View>

      {/* ── Search bar ────────────────────────────────────────────── */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchSection}>
          <View style={styles.searchInputWrapper}>
            {geocoding ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            )}
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={addressQuery}
              onChangeText={setAddressQuery}
              onFocus={() => candidates.length > 0 && setShowSuggestions(true)}
              // The delay lets a tap on a suggestion register before the
              // list disappears -- onBlur otherwise fires first and the
              // FlatList unmounts out from under the touch.
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={styles.locateButton}
            onPress={locateMe}
            disabled={locating}
            accessibilityLabel={t('search.location.refresh')}
          >
            {locating ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="locate" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>

        {showSuggestions && (
          <View style={styles.suggestionsDropdown}>
            {candidates.length > 0 ? (
              <FlatList
                data={candidates}
                keyExtractor={(item, index) => `${item.lat}-${item.lng}-${index}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.candidateRow} onPress={() => selectCandidate(item)}>
                    <Ionicons name="location-outline" size={18} color={colors.teal} />
                    <Text style={styles.candidateMain} numberOfLines={2}>
                      {item.displayName}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              !geocoding && addressError && <Text style={styles.candidateEmpty}>{addressError}</Text>
            )}
          </View>
        )}
      </View>
      {!searchAddress && (
        <Text style={styles.statusText}>
          {locationError
            ? locationError
            : location
            ? `📍 ${t('search.location.searching')}`
            : t('search.location.locating')}
        </Text>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
          <Ionicons
            name="options-outline"
            size={15}
            color={hasActiveFilters ? colors.teal : colors.textSecondary}
          />
          <Text style={styles.filterButtonText}>{t('search.filters')}</Text>
          {hasActiveFilters && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeChips.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, viewMode === 'list' && styles.segmentActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={14}
              color={viewMode === 'list' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.segmentText, viewMode === 'list' && styles.segmentTextActive]}>
              {t('search.viewList')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, viewMode === 'map' && styles.segmentActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons
              name="map-outline"
              size={14}
              color={viewMode === 'map' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.segmentText, viewMode === 'map' && styles.segmentTextActive]}>
              {t('search.viewMap')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Active filter chips ────────────────────────────────────── */}
      {activeChips.length > 0 && (
        <View style={styles.activeFiltersRow}>
          {activeChips.map((chip) => (
            <Chip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </View>
      )}

      {/* ── Results ────────────────────────────────────────────────── */}
      {viewMode === 'list' ? (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: `/(driver)/spot/${item.id}`,
                  params: { startHour: '8', endHour: '9' },
                })
              }
            >
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
                  <Text style={styles.pinText}>${getDriverVisiblePrice(spot.pricePerHour)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedSpot && (
            <View style={styles.mapCardWrapper}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `/(driver)/spot/${selectedSpot.id}`,
                    params: { startHour: '8', endHour: '9' },
                  })
                }
              >
                <ParkingSpotCard spot={selectedSpot} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Filter modal ───────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{t('search.filters.title')}</Text>

              <Text style={styles.sectionLabel}>{t('search.filters.pricePerHour')}</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder={t('search.filters.minPrice')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={minPriceInput}
                  onChangeText={setMinPriceInput}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('search.filters.maxPrice')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={maxPriceInput}
                  onChangeText={setMaxPriceInput}
                />
              </View>

              <Text style={styles.sectionLabel}>{t('search.filters.type')}</Text>
              <View style={styles.chipsWrap}>
                <Chip
                  label={coveredOnly ? t('search.filters.coveredOnly') : t('search.filters.coveredAny')}
                  selected={coveredOnly}
                  onPress={() => setCoveredOnly((v) => !v)}
                />
              </View>

              <Text style={styles.sectionLabel}>{t('search.filters.distance')}</Text>
              <View style={styles.chipsWrap}>
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

              <Button
                title={t('search.filters.apply')}
                onPress={applyFilters}
                style={styles.applyButton}
              />
              <Text style={styles.clearLink} onPress={clearFilters}>
                {t('search.filters.clear')}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
