import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { Button } from '@/src/components/Button';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { Screen } from '@/src/components/Screen';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';
import { searchParkingSpots, SearchParkingSpotsFilters } from '@/src/services/parkingService';
import { geocodeAddress, reverseGeocode, GeocodeCandidate } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';
import { useLocationPermission } from '@/src/hooks/useLocationPermission';
import { MAP_STYLE } from '@/src/theme/mapStyle';

const DISTANCE_OPTIONS = [
  { label: '< 500 m', value: 500 },
  { label: '< 1 km', value: 1000 },
  { label: '< 2 km', value: 2000 },
];

// Default center: Buenos Aires
const DEFAULT_REGION: Region = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function SearchScreen() {
  const colors = useThemeColors();
  const group = `/${useSegments()[0]}`;
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchParkingSpotsFilters>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  // Used to prevent the map's onPress from immediately clearing a marker
  // selection: the marker sets this to true, then the map onPress checks it.
  const markerJustPressed = useRef(false);
  // locateMe() fills addressQuery with the reverse-geocoded address (same as
  // the publish-spot screen) -- this stops that programmatic update from
  // being treated as the user typing and re-triggering the suggestions dropdown.
  const skipNextAddressSuggestions = useRef(false);

  // useLocationPermission requests the system permission dialog as soon as
  // this screen mounts. We do NOT call requestForegroundPermissionsAsync()
  // anywhere else — calling it twice causes iOS to silently skip the dialog
  // on the second call because it was already resolved by the first one.
  const { status: permissionStatus, loading: permissionLoading } = useLocationPermission();

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
  const [stayOnly, setStayOnly] = useState(false);
  const [distanceInput, setDistanceInput] = useState<number | undefined>(undefined);
  const [scheduleFilterOn, setScheduleFilterOn] = useState(false);
  const [fromHourInput, setFromHourInput] = useState(8);
  const [toHourInput, setToHourInput] = useState(9);

  // fillAddress is true only when the user actually taps the locate button --
  // the automatic GPS fix on first mount (see the permission effect below)
  // should not fill the search box on its own.
  async function locateMe(fillAddress = false) {
    // Switching to GPS overrides any active address search.
    setSearchAddress(null);
    setAddressError(null);
    setCandidates([]);
    setShowSuggestions(false);
    if (!fillAddress) {
      setAddressQuery('');
    }

    setLocating(true);
    setLocationError(null);
    try {
      // Always re-request here so that if the user previously denied and then
      // manually re-enabled in Settings, tapping the button picks it up.
      // On a fresh install this will be the ONLY call — useLocationPermission
      // no longer calls requestForegroundPermissionsAsync(); it only reads the
      // current status so we know whether to call locateMe() automatically.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(t('search.location.permissionError'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLocation({ lat, lng });

      if (fillAddress) {
        // Same as the publish/edit-spot screens' "use my current location" --
        // show the resolved address where the user types, instead of leaving
        // the search box empty after a GPS fix.
        skipNextAddressSuggestions.current = true;
        try {
          const reversed = await reverseGeocode(lat, lng);
          setAddressQuery(reversed.displayName);
        } catch {
          setAddressQuery(t('owner.spot.new.locationFallback'));
        }
      }
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
    if (skipNextAddressSuggestions.current) {
      skipNextAddressSuggestions.current = false;
      return;
    }

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

  // Once the permission check resolves, decide what to do:
  //   - undetermined → call locateMe(), which calls requestForegroundPermissionsAsync()
  //                    and shows the system dialog for the first time.
  //   - granted      → call locateMe() to get the actual GPS coordinates (no dialog).
  //   - denied       → fall back to BA default region (no dialog, user already said no).
  useEffect(() => {
    if (permissionLoading) return;
    if (permissionStatus === 'denied') {
      // User previously denied — load spots for default BA coords without asking again.
      setLocationError(t('search.location.permissionError'));
    } else {
      // undetermined (first open) or already granted — locateMe() will show the
      // system dialog if needed, then get the GPS position.
      locateMe();
    }
  }, [permissionLoading]);

  // Search coords: real GPS position when available, BA default otherwise.
  // This guarantees the API is always called and the map always has results.
  const searchCoords = location ?? {
    lat: DEFAULT_REGION.latitude,
    lng: DEFAULT_REGION.longitude,
  };

  useEffect(() => {
    // Don't search while the permission check is still in flight or while
    // GPS is being acquired — otherwise we fire with the BA default coords
    // before the real position arrives and show an empty "no results" state.
    if (permissionLoading || locating) return;

    // Animate the map when real location arrives.
    if (location) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        600,
      );
    }

    setSpotsError(null);
     
    setLoadingSpots(true);
    searchParkingSpots({ ...filters, lat: searchCoords.lat, lng: searchCoords.lng })
      .then((results) => {
        // Never show the driver their own listings here -- if they search
        // from home, their own garage is always "nearby" and can't be
        // booked by themselves anyway.
        const filtered = results.filter((spot) => spot.ownerId !== user?.id);
        setSpots(filtered);
        setSelectedSpotId(filtered[0]?.id ?? null);
      })
      .catch((err) => {
        setSpotsError(err instanceof ApiError ? err.detail : t('search.location.error'));
      })
      .finally(() => setLoadingSpots(false));
  }, [filters, location, permissionLoading, locating, user?.id]);

  function openFilters() {
    setMinPriceInput(filters.minPrice ? String(filters.minPrice) : '');
    setMaxPriceInput(filters.maxPrice ? String(filters.maxPrice) : '');
    setCoveredOnly(filters.covered ?? false);
    setStayOnly(filters.stayOnly ?? false);
    setDistanceInput(filters.maxDistanceMeters);
    setScheduleFilterOn(filters.fromHour !== undefined);
    setFromHourInput(filters.fromHour ?? 8);
    setToHourInput(filters.toHour ?? 9);
    setModalVisible(true);
  }

  function applyFilters() {
    setFilters({
      minPrice: minPriceInput ? Number(minPriceInput) : undefined,
      maxPrice: maxPriceInput ? Number(maxPriceInput) : undefined,
      covered: coveredOnly || undefined,
      stayOnly: stayOnly || undefined,
      maxDistanceMeters: distanceInput,
      fromHour: scheduleFilterOn ? fromHourInput : undefined,
      toHour: scheduleFilterOn ? toHourInput : undefined,
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
  if (filters.stayOnly) {
    activeChips.push({
      label: t('search.filters.stayOnly'),
      onRemove: () => setFilters((f) => ({ ...f, stayOnly: undefined })),
    });
  }
  if (filters.maxDistanceMeters !== undefined) {
    activeChips.push({
      label: DISTANCE_OPTIONS.find((d) => d.value === filters.maxDistanceMeters)?.label ?? '',
      onRemove: () => setFilters((f) => ({ ...f, maxDistanceMeters: undefined })),
    });
  }
  if (filters.fromHour !== undefined && filters.toHour !== undefined) {
    activeChips.push({
      label: `${String(filters.fromHour).padStart(2, '0')}:00–${String(filters.toHour).padStart(2, '0')}:00`,
      onRemove: () => setFilters((f) => ({ ...f, fromHour: undefined, toHour: undefined })),
    });
  }

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? null;
  const hasActiveFilters = activeChips.length > 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    // Same "use my current location" button as the publish/edit spot screens
    // (AddressAutocomplete's sibling square button), reused here next to search.
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
    // ── Loading / empty / error states ──────────────────────────────────────
    centeredFeedback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 12,
    },
    feedbackText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryButton: {
      marginTop: 4,
      paddingHorizontal: 20,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.teal,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.teal,
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
    },
    map: {
      flex: 1,
    },
    // Price pin bubble shown on each marker
    pin: {
      backgroundColor: colors.deepNavy,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 2,
      borderColor: colors.white,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: { elevation: 4 },
      }),
    },
    pinSelected: {
      backgroundColor: colors.teal,
      transform: [{ scale: 1.15 }],
    },
    pinText: { color: colors.white, fontSize: 12, fontWeight: '700' },
    // "My location" FAB -- top-right, clear of the selected-spot card that
    // can pop up over the bottom of the map (avoids guessing that card's
    // height to avoid overlapping it).
    locateFab: {
      position: 'absolute',
      right: 16,
      top: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    mapCardWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingBottom: 16,
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
    scheduleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    hourBlock: { flex: 1, gap: 4 },
    hourLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
    hourControl: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.background,
    },
    hourBtn: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    },
    hourValue: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 44, textAlign: 'center' },
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
            {addressQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setAddressQuery('');
                  setCandidates([]);
                  setShowSuggestions(false);
                  setAddressError(null);
                }}
                accessibilityLabel={t('search.clearAddress')}
              >
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.locateButton}
            onPress={() => locateMe(true)}
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
          {/* react-native-maps/react-native-map-clustering have no web build --
              metro.config.js resolves them to an empty stub there to avoid
              crashing the whole app, which means rendering <ClusteredMapView>/
              <Marker> throws the moment this tab switches to map view. Simplest
              fix: don't offer map view at all on web instead of offering a
              broken button. */}
          {Platform.OS !== 'web' && (
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
          )}
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
      {viewMode === 'list' || Platform.OS === 'web' ? (
        loadingSpots || permissionLoading || locating ? (
          <View style={styles.centeredFeedback}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
        ) : spotsError ? (
          <View style={styles.centeredFeedback}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.feedbackText}>{spotsError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setSpotsError(null);
                setLoadingSpots(true);
                searchParkingSpots({ ...filters, lat: searchCoords.lat, lng: searchCoords.lng })
                  .then((results) => {
                    const filtered = results.filter((spot) => spot.ownerId !== user?.id);
                    setSpots(filtered);
                    setSelectedSpotId(filtered[0]?.id ?? null);
                  })
                  .catch((err) => setSpotsError(err instanceof ApiError ? err.detail : t('search.location.error')))
                  .finally(() => setLoadingSpots(false));
              }}
            >
              <Text style={styles.retryButtonText}>{t('search.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : spots.length === 0 ? (
          <View style={styles.centeredFeedback}>
            <Ionicons name="car-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.feedbackText}>{t('search.noResults')}</Text>
          </View>
        ) : (
          <FlatList
            data={spots}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `${group}/spot/${item.id}`,
                    params: { startHour: '8', endHour: '9' },
                  })
                }
              >
                <ParkingSpotCard
                  spot={item}
                  isFavorite={favoriteIds.has(item.id)}
                  onToggleFavorite={() => toggleFavorite(item.id)}
                />
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        <View style={styles.mapWrapper}>
          <ClusteredMapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={DEFAULT_REGION}
            customMapStyle={MAP_STYLE}
            showsUserLocation
            showsMyLocationButton={false}
            showsPointsOfInterests={false}
            clusterColor={colors.teal}
            clusterTextColor={colors.white}
            clusterFontFamily="System"
            animationEnabled
            onPress={() => {
              if (markerJustPressed.current) {
                markerJustPressed.current = false;
                return;
              }
              setSelectedSpotId(null);
            }}
          >
            {spots.map((spot) => {
              const isSelected = spot.id === selectedSpotId;
              return (
                <Marker
                  key={spot.id}
                  coordinate={{ latitude: spot.lat, longitude: spot.lng }}
                  onPress={() => {
                   markerJustPressed.current = true;
                   setSelectedSpotId(spot.id);
                  }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.pin, isSelected && styles.pinSelected]}>
                    <Text style={styles.pinText}>
                      {spot.pricePerHour !== null ? `$${getDriverVisiblePrice(spot.pricePerHour)}` : t('spot.stayOnlyBadge')}
                    </Text>
                  </View>
                </Marker>
              );
            })}
          </ClusteredMapView>

          {/* Loading overlay on map */}
          {(loadingSpots || permissionLoading || locating) && (
            <View
              pointerEvents="none"
              style={[
                styles.centeredFeedback,
                { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
              ]}
            >
              <ActivityIndicator color={colors.teal} size="large" />
            </View>
          )}

          {/* No results overlay on map */}
          {!loadingSpots && !permissionLoading && !locating && !spotsError && spots.length === 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.centeredFeedback,
                { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: 'transparent' },
              ]}
            >
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', gap: 8 }}>
                <Ionicons name="car-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.feedbackText}>{t('search.noResults')}</Text>
              </View>
            </View>
          )}

          {/* Locate FAB */}
          <TouchableOpacity
            style={styles.locateFab}
            onPress={() => {
              if (location) {
                mapRef.current?.animateToRegion(
                  {
                    latitude: location.lat,
                    longitude: location.lng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  },
                  400,
                );
              } else {
                locateMe();
              }
            }}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <Ionicons name="locate" size={20} color={colors.teal} />
            )}
          </TouchableOpacity>

          {/* Selected spot card */}
          {selectedSpot && (
            <View style={styles.mapCardWrapper}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `${group}/spot/${selectedSpot.id}`,
                    params: { startHour: '8', endHour: '9' },
                  })
                }
              >
                <ParkingSpotCard spot={selectedSpot} compact />
              </TouchableOpacity>
            </View>
          )}
        </View>
        )
      }

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

              <Text style={styles.sectionLabel}>{t('search.filters.stay')}</Text>
              <View style={styles.chipsWrap}>
                <Chip
                  label={t('search.filters.stayOnly')}
                  selected={stayOnly}
                  onPress={() => setStayOnly((v) => !v)}
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

              <Text style={styles.sectionLabel}>{t('search.filters.schedule')}</Text>
              <View style={styles.chipsWrap}>
                <Chip
                  label={t('search.filters.scheduleFilter')}
                  selected={scheduleFilterOn}
                  onPress={() => setScheduleFilterOn((v) => !v)}
                />
              </View>
              {scheduleFilterOn && (
                <View style={styles.scheduleRow}>
                  <View style={styles.hourBlock}>
                    <Text style={styles.hourLabel}>{t('search.filters.from')}</Text>
                    <View style={styles.hourControl}>
                      <TouchableOpacity
                        style={styles.hourBtn}
                        onPress={() => setFromHourInput((h) => Math.max(0, Math.min(h - 1, toHourInput - 1)))}
                      >
                        <Ionicons name="remove" size={14} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.hourValue}>{String(fromHourInput).padStart(2, '0')}:00</Text>
                      <TouchableOpacity
                        style={styles.hourBtn}
                        onPress={() => setFromHourInput((h) => Math.min(toHourInput - 1, h + 1))}
                      >
                        <Ionicons name="add" size={14} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.hourBlock}>
                    <Text style={styles.hourLabel}>{t('search.filters.until')}</Text>
                    <View style={styles.hourControl}>
                      <TouchableOpacity
                        style={styles.hourBtn}
                        onPress={() => setToHourInput((h) => Math.max(fromHourInput + 1, h - 1))}
                      >
                        <Ionicons name="remove" size={14} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.hourValue}>{String(toHourInput).padStart(2, '0')}:00</Text>
                      <TouchableOpacity
                        style={styles.hourBtn}
                        onPress={() => setToHourInput((h) => Math.min(23, Math.max(h + 1, fromHourInput + 1)))}
                      >
                        <Ionicons name="add" size={14} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

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

export default function Search() {
  return <SearchScreen />;
}
