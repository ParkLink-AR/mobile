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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { Button } from '@/src/components/Button';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { Screen } from '@/src/components/Screen';
import { DatePickerField } from '@/src/components/DatePickerField';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';
import {
  searchParkingSpots, spotListPrice, SearchParkingSpotsFilters, AVAILABLE_NOW_HOURS,
} from '@/src/services/parkingService';
import { getVehicles } from '@/src/api/auth';
import { vehicleName } from '@/src/components/VehicleIdentity';
import { VEHICLE_TYPES, VEHICLE_TYPE_LABEL_KEYS, VehicleType } from '@/src/constants/vehicleTypes';

import { todayArtDateISO } from '@/src/services/dateUtils';
import { formatShortDate } from '@/src/services/bookingDates';
import { geocodeAddress, reverseGeocode, GeocodeCandidate, SearchSort } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { ParkingSpot, Vehicle } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';
import { useLocationPermission } from '@/src/hooks/useLocationPermission';
import { MAP_STYLE } from '@/src/theme/mapStyle';
import { useScale } from '@/src/theme/typography';

// How the results can be ordered (see search.sort.* in the i18n files).
const SORTS: SearchSort[] = ['distance', 'price', 'rating'];

// Precio a mostrar en el pin del mapa: por hora si la cochera lo ofrece (aunque también
// tenga estadía), si no por día -- y por día siempre que se busquen estadías. Con el
// vehículo elegido en los filtros, su tarifa (ver spotListPrice).
function mapPinPrice(
  spot: ParkingSpot,
  commissionRatePercent: number,
  options: { stays?: boolean; halfDay?: boolean; vehicleType?: VehicleType },
): string {
  const price = spotListPrice(spot, options) ?? spotListPrice(spot, { ...options, halfDay: false, stays: true });
  if (price === null) return t('spot.stayOnlyBadge');
  const amount = `$${getDriverVisiblePrice(price.amount, commissionRatePercent)}`;
  if (price.unit === 'day') return `${amount}${t('spot.pricePerDay.short')}`;
  if (price.unit === 'halfDay') return `${amount}${t('spot.pricePerHalfDay.short')}`;
  return amount;
}

// Calificación mínima que se puede pedir en los filtros.
const MIN_RATINGS = [3, 4, 4.5];

// Default center: Buenos Aires
const DEFAULT_REGION: Region = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function SearchScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const scale = useScale();
  // With large text the list/map switch shows just its icons: with the words it doesn't
  // fit next to the button beside it.
  const iconOnlySwitch = scale > 1;
  const sc = (n: number) => Math.round(n * scale);
  const group = `/${useSegments()[0]}`;
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchParkingSpotsFilters>({});
  const [modalVisible, setModalVisible] = useState(false);
  // The map first: it's what a driver opens the app to see. Web has no map (see the
  // toggle below), so it starts on the list there.
  const [viewMode, setViewMode] = useState<'list' | 'map'>(Platform.OS === 'web' ? 'list' : 'map');
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
  const [hourlyOnlyFilter, setHourlyOnlyFilter] = useState(false);
  // "Media estadía (12 h)": a third reservation type, exclusive with the other two.
  const [halfDayOnlyFilter, setHalfDayOnlyFilter] = useState(false);
  // Km en texto libre (no un preset) -- se convierte a metros recién al aplicar.
  const [distanceKmInput, setDistanceKmInput] = useState('');
  // Cuándo (reservas por hora): cualquier momento, libre ahora mismo, o un día y franja.
  const [whenMode, setWhenMode] = useState<'any' | 'now' | 'pick'>('any');
  const [dateInput, setDateInput] = useState(''); // YYYY-MM-DD, '' = hoy
  const [fromHourInput, setFromHourInput] = useState(8);
  const [toHourInput, setToHourInput] = useState(9);
  // Fechas de una estadía (con "Estadía" elegido): check-in y check-out, YYYY-MM-DD.
  const [stayFromInput, setStayFromInput] = useState('');
  const [stayToInput, setStayToInput] = useState('');
  const [vehicleTypeInput, setVehicleTypeInput] = useState<VehicleType | null>(null);
  // El vehículo guardado que se tocó, sólo para marcar su chip (filtra por su tipo).
  const [vehicleIdInput, setVehicleIdInput] = useState<string | null>(null);
  const [minRatingInput, setMinRatingInput] = useState<number | null>(null);
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);

  // Selecciona un tipo de reserva a la vez -- elegir uno apaga los otros; tocar el que ya
  // está prendido lo apaga (vuelve a "todas"). Por defecto (ninguno prendido) se ven todos.
  function toggleStayOnly() {
    setStayOnly((v) => {
      const next = !v;
      if (next) {
        setHourlyOnlyFilter(false);
        setHalfDayOnlyFilter(false);
      }
      return next;
    });
  }
  function toggleHourlyOnly() {
    setHourlyOnlyFilter((v) => {
      const next = !v;
      if (next) {
        setStayOnly(false);
        setHalfDayOnlyFilter(false);
      }
      return next;
    });
  }
  function toggleHalfDayOnly() {
    setHalfDayOnlyFilter((v) => {
      const next = !v;
      if (next) {
        setStayOnly(false);
        setHourlyOnlyFilter(false);
      }
      return next;
    });
  }


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

  // Animate the map when a real location arrives -- only then: re-centering it on every
  // filter change too would swap the markers while the map is still moving.
  useEffect(() => {
    if (!location) return;
    mapRef.current?.animateToRegion(
      {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      600,
    );
  }, [location]);

  // Each search gets a number; only the latest one may write its results, so a slow
  // earlier response (filters changed again meanwhile) can't overwrite the newer list.
  const searchSeq = useRef(0);

  function runSearch() {
    const seq = ++searchSeq.current;
    setSpotsError(null);
    setLoadingSpots(true);
    searchParkingSpots({ ...filters, lat: searchCoords.lat, lng: searchCoords.lng }, commissionRatePercent)
      .then((results) => {
        if (seq !== searchSeq.current) return;
        // The user's own spots stay in the results -- opening one shows "Esta es tu
        // cochera" instead of the booking options (see spot/[id].tsx).
        setSpots(results);
        setSelectedSpotId(results[0]?.id ?? null);
      })
      .catch((err) => {
        if (seq !== searchSeq.current) return;
        setSpotsError(err instanceof ApiError ? err.detail : t('search.location.error'));
      })
      .finally(() => {
        if (seq === searchSeq.current) setLoadingSpots(false);
      });
  }

  useEffect(() => {
    // Don't search while the permission check is still in flight or while
    // GPS is being acquired — otherwise we fire with the BA default coords
    // before the real position arrives and show an empty "no results" state.
    if (permissionLoading || locating) return;
    runSearch();
  }, [filters, location, permissionLoading, locating, user?.id]);

  function openFilters() {
    setMinPriceInput(filters.minPrice ? String(filters.minPrice) : '');
    setMaxPriceInput(filters.maxPrice ? String(filters.maxPrice) : '');
    setCoveredOnly(filters.covered ?? false);
    setStayOnly(filters.stayOnly ?? false);
    setHalfDayOnlyFilter(filters.halfDayOnly ?? false);
    setHourlyOnlyFilter(filters.hourlyOnly ?? false);
    setDistanceKmInput(filters.maxDistanceMeters !== undefined ? String(filters.maxDistanceMeters / 1000) : '');
    setWhenMode(filters.availableNow ? 'now' : filters.fromHour !== undefined ? 'pick' : 'any');
    setDateInput(filters.date ?? '');
    setFromHourInput(filters.fromHour ?? 8);
    setToHourInput(filters.toHour ?? 9);
    setStayFromInput(filters.stayFrom ?? '');
    setStayToInput(filters.stayTo ?? '');
    setVehicleTypeInput(filters.vehicleType ?? null);
    setVehicleIdInput(filters.vehicleId ?? null);
    setMinRatingInput(filters.minRating ?? null);
    setModalVisible(true);
    // The driver's saved vehicles, as shortcuts for the vehicle filter.
    if (user?.id) {
      getVehicles(user.id)
        .then((list) => setMyVehicles(list.filter((v) => v.type !== null)))
        .catch(() => setMyVehicles([]));
    }
  }

  function applyFilters() {
    const km = Number(distanceKmInput);
    setFilters({
      minPrice: minPriceInput ? Number(minPriceInput) : undefined,
      maxPrice: maxPriceInput ? Number(maxPriceInput) : undefined,
      covered: coveredOnly || undefined,
      stayOnly: stayOnly || undefined,
      hourlyOnly: hourlyOnlyFilter || undefined,
      halfDayOnly: halfDayOnlyFilter || undefined,
      maxDistanceMeters: distanceKmInput.trim() && km > 0 ? Math.round(km * 1000) : undefined,
      vehicleType: vehicleTypeInput ?? undefined,
      vehicleId: vehicleTypeInput ? (vehicleIdInput ?? undefined) : undefined,
      minRating: minRatingInput ?? undefined,
      // The hourly "when" and a stay's dates don't go together: which one applies follows
      // the reservation type.
      availableNow: !stayOnly && whenMode === 'now' ? true : undefined,
      date: !stayOnly && whenMode === 'pick' ? (dateInput || undefined) : undefined,
      fromHour: !stayOnly && whenMode === 'pick' ? fromHourInput : undefined,
      toHour: !stayOnly && whenMode === 'pick' ? toHourInput : undefined,
      stayFrom: stayOnly && stayFromInput && stayToInput > stayFromInput ? stayFromInput : undefined,
      stayTo: stayOnly && stayFromInput && stayToInput > stayFromInput ? stayToInput : undefined,
      // The order is chosen outside the filters: applying or clearing them keeps it.
      sort: filters.sort,
    });
    setModalVisible(false);
  }

  function clearFilters() {
    setFilters({ sort: filters.sort });
    setModalVisible(false);
  }

  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (searchAddress) {
    // locateMe only runs when the chip is tapped (an event handler), never during render --
    // the refs rule can't tell a stored callback apart from a call.
    // eslint-disable-next-line react-hooks/refs
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
      onRemove: () => setFilters((f) => ({ ...f, stayOnly: undefined, stayFrom: undefined, stayTo: undefined })),
    });
  }
  if (filters.stayFrom && filters.stayTo) {
    activeChips.push({
      label: `${formatShortDate(filters.stayFrom)} – ${formatShortDate(filters.stayTo)}`,
      onRemove: () => setFilters((f) => ({ ...f, stayFrom: undefined, stayTo: undefined })),
    });
  }
  if (filters.vehicleType) {
    const saved = myVehicles.find((v) => v.id === filters.vehicleId);
    activeChips.push({
      label: saved ? vehicleName(saved) : t(VEHICLE_TYPE_LABEL_KEYS[filters.vehicleType]),
      onRemove: () => setFilters((f) => ({ ...f, vehicleType: undefined, vehicleId: undefined })),
    });
  }
  if (filters.minRating !== undefined) {
    activeChips.push({
      label: t('search.filters.ratingValue', { rating: String(filters.minRating) }),
      onRemove: () => setFilters((f) => ({ ...f, minRating: undefined })),
    });
  }
  if (filters.availableNow) {
    activeChips.push({
      label: t('search.filters.availableNow'),
      onRemove: () => setFilters((f) => ({ ...f, availableNow: undefined })),
    });
  }
  if (filters.hourlyOnly) {
    activeChips.push({
      label: t('search.filters.hourlyOnly'),
      onRemove: () => setFilters((f) => ({ ...f, hourlyOnly: undefined })),
    });
  }
  if (filters.halfDayOnly) {
    activeChips.push({
      label: t('search.filters.halfDayOnly'),
      onRemove: () => setFilters((f) => ({ ...f, halfDayOnly: undefined })),
    });
  }
  if (filters.maxDistanceMeters !== undefined) {
    const km = filters.maxDistanceMeters / 1000;
    activeChips.push({
      label: t('search.filters.distanceValue', { km: String(Number(km.toFixed(1))) }),
      onRemove: () => setFilters((f) => ({ ...f, maxDistanceMeters: undefined })),
    });
  }
  if (filters.fromHour !== undefined && filters.toHour !== undefined) {
    const dateLabel = filters.date ? `${formatShortDate(filters.date)} ` : '';
    activeChips.push({
      label: filters.halfDayOnly
        ? `${dateLabel}${t('search.filters.halfDayFrom', { hour: `${String(filters.fromHour).padStart(2, '0')}:00` })}`
        : `${dateLabel}${String(filters.fromHour).padStart(2, '0')}:00–${String(filters.toHour % 24).padStart(2, '0')}:00`,
      onRemove: () => setFilters((f) => ({ ...f, date: undefined, fromHour: undefined, toHour: undefined })),
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
    locationErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationErrorText: { flex: 1, fontSize: sc(13), color: colors.textSecondary },
    candidateEmpty: {
      paddingVertical: 16,
      fontSize: sc(13),
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
      fontSize: sc(14),
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
      fontSize: sc(13),
      backgroundColor: colors.surface,
    },
    error: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
      color: '#C62828',
      fontSize: sc(13),
      backgroundColor: colors.surface,
    },
    // ── Toolbar (filters + view toggle) ─────────────────────────────────────
    // Con letra grande "Filtros" y el switch Lista/Mapa no entran en una línea: el switch baja a la siguiente.
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
      fontSize: sc(13),
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
      fontSize: sc(10),
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
      marginLeft: 'auto',
      maxWidth: '100%',
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
      fontSize: sc(13),
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.white,
    },
    // ── Active filter chips ──────────────────────────────────────────────────
    sortScroll: { flexGrow: 0, flexShrink: 0 },
    sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
    sortLabel: { fontSize: sc(13), color: colors.textSecondary, fontWeight: '600', marginRight: 8, marginBottom: 6 },
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
      fontSize: sc(15),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: sc(22),
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
      fontSize: sc(13),
      fontWeight: '600',
      color: colors.teal,
    },
    // ── List content ────────────────────────────────────────────────────────
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 12,
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
    pinText: { color: colors.white, fontSize: sc(12), fontWeight: '700' },
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
      fontSize: sc(18),
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: sc(12),
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
      fontSize: sc(15),
      color: colors.text,
      backgroundColor: colors.background,
    },
    dateRow: { marginTop: 4 },
    scheduleRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
    hourBlock: { flex: 1, gap: 4 },
    hourLabel: { fontSize: sc(11), color: colors.textSecondary, fontWeight: '500' },
    hourControl: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.background,
    },
    hourBtn: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    },
    hourValue: { fontSize: sc(14), fontWeight: '700', color: colors.text, minWidth: 44, textAlign: 'center' },
    applyButton: { marginTop: 20, marginBottom: 6 },
    clearLink: {
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 4,
      fontSize: sc(14),
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
    candidateMain: { flex: 1, minWidth: 0, fontSize: sc(14), color: colors.text, lineHeight: sc(19) },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right']}>
      {/* El inset de la barra de estado usa el fondo gris de la pantalla
          (necesario más abajo para que las tarjetas de la lista resalten) --
          esta franja lo pinta blanco para que combine con la barra de
          búsqueda, en vez de dejar un gris visible justo arriba. */}
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      {/* ── Search bar ────────────────────────────────────────────── */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchSection}>
          <View style={styles.searchInputWrapper}>
            {geocoding ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Ionicons name="search-outline" size={sc(16)} color={colors.textSecondary} />
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
                <Ionicons name="close-circle" size={sc(18)} color={colors.textSecondary} />
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
              <Ionicons name="locate" size={sc(20)} color={colors.white} />
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
                    <Ionicons name="location-outline" size={sc(18)} color={colors.teal} />
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
      {locationError && (
        <View style={styles.locationErrorBanner}>
          <Ionicons name="navigate-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.locationErrorText}>{locationError}</Text>
          <TouchableOpacity onPress={() => setLocationError(null)} hitSlop={8} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
          <Ionicons
            name="options-outline"
            size={sc(15)}
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
            accessibilityLabel={t('search.viewList')}
          >
            <Ionicons
              name="list-outline"
              size={sc(iconOnlySwitch ? 16 : 14)}
              color={viewMode === 'list' ? colors.white : colors.textSecondary}
            />
            {!iconOnlySwitch && (
              <Text style={[styles.segmentText, viewMode === 'list' && styles.segmentTextActive]}>
                {t('search.viewList')}
              </Text>
            )}
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
              accessibilityLabel={t('search.viewMap')}
            >
              <Ionicons
                name="map-outline"
                size={sc(iconOnlySwitch ? 16 : 14)}
                color={viewMode === 'map' ? colors.white : colors.textSecondary}
              />
              {!iconOnlySwitch && (
                <Text style={[styles.segmentText, viewMode === 'map' && styles.segmentTextActive]}>
                  {t('search.viewMap')}
                </Text>
              )}
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

      {/* ── Sort (list only: on the map, order doesn't matter) ─────────── */}
      {(viewMode === 'list' || Platform.OS === 'web') && spots.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll} contentContainerStyle={styles.sortRow}>
          <Text style={styles.sortLabel}>{t('search.sort.label')}</Text>
          {SORTS.map((option) => (
            <Chip
              key={option}
              label={t(`search.sort.${option}`)}
              selected={(filters.sort ?? 'distance') === option}
              onPress={() => setFilters((current) => ({ ...current, sort: option === 'distance' ? undefined : option }))}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Results ────────────────────────────────────────────────── */}
      {viewMode === 'list' || Platform.OS === 'web' ? (
        loadingSpots || permissionLoading || locating ? (
          <View style={styles.centeredFeedback}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
        ) : spotsError ? (
          <View style={styles.centeredFeedback}>
            <Ionicons name="cloud-offline-outline" size={sc(40)} color={colors.textSecondary} />
            <Text style={styles.feedbackText}>{spotsError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={runSearch}
            >
              <Text style={styles.retryButtonText}>{t('search.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : spots.length === 0 ? (
          <View style={styles.centeredFeedback}>
            <Ionicons name="car-outline" size={sc(40)} color={colors.textSecondary} />
            <Text style={styles.feedbackText}>{t('search.noResults')}</Text>
          </View>
        ) : (
          <FlatList
            data={spots}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            // Hundreds of cards with photos: render a few at a time, and only around what's on
            // screen, so scrolling and new results stay smooth.
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
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
                  stays={filters.stayOnly}
                  halfDay={filters.halfDayOnly}
                  vehicleType={filters.vehicleType}
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
            // Off: on iOS the library animates the next update with LayoutAnimation, and if
            // that update is new search results (markers removed mid-animation) the app
            // crashes natively -- only sometimes, depending on when the response lands.
            animationEnabled={false}
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
                    <Text style={styles.pinText}>{mapPinPrice(spot, commissionRatePercent, { stays: filters.stayOnly, halfDay: filters.halfDayOnly, vehicleType: filters.vehicleType })}</Text>
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
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center', gap: 8 }}>
                <Ionicons name="car-outline" size={sc(28)} color={colors.textSecondary} />
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
              <Ionicons name="locate" size={sc(20)} color={colors.teal} />
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
                <ParkingSpotCard spot={selectedSpot} compact stays={filters.stayOnly} halfDay={filters.halfDayOnly} vehicleType={filters.vehicleType} />
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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('search.filters.title')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>{t('search.filters.reservationType')}</Text>
              <View style={styles.chipsWrap}>
                <Chip
                  label={t('search.filters.hourlyOnly')}
                  selected={hourlyOnlyFilter}
                  onPress={toggleHourlyOnly}
                />
                <Chip
                  label={t('search.filters.halfDayOnly')}
                  selected={halfDayOnlyFilter}
                  onPress={toggleHalfDayOnly}
                />
                <Chip
                  label={t('search.filters.stayOnly')}
                  selected={stayOnly}
                  onPress={toggleStayOnly}
                />
              </View>

              {stayOnly ? (
                <>
                  <Text style={styles.sectionLabel}>{t('search.filters.stayDates')}</Text>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hourLabel}>{t('search.filters.checkIn')}</Text>
                      <DatePickerField
                        value={stayFromInput}
                        onChange={(value) => {
                          setStayFromInput(value);
                          if (stayToInput && stayToInput <= value) setStayToInput('');
                        }}
                        placeholder={t('search.filters.datePlaceholderShort')}
                        minimumDate={new Date(`${todayArtDateISO()}T00:00:00`)}
                        style={styles.input}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hourLabel}>{t('search.filters.checkOut')}</Text>
                      <DatePickerField
                        value={stayToInput}
                        onChange={setStayToInput}
                        placeholder={t('search.filters.datePlaceholderShort')}
                        minimumDate={new Date(`${stayFromInput || todayArtDateISO()}T00:00:00`)}
                        style={styles.input}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.sectionLabel}>{t('search.filters.schedule')}</Text>
                  <View style={styles.chipsWrap}>
                    <Chip label={t('search.filters.anyTime')} selected={whenMode === 'any'} onPress={() => setWhenMode('any')} />
                    <Chip
                      label={t('search.filters.availableNowHours', { hours: String(AVAILABLE_NOW_HOURS) })}
                      selected={whenMode === 'now'}
                      onPress={() => setWhenMode('now')}
                    />
                    <Chip label={t('search.filters.scheduleFilter')} selected={whenMode === 'pick'} onPress={() => setWhenMode('pick')} />
                  </View>
                  {whenMode === 'pick' && (
                    <>
                      <View style={styles.dateRow}>
                        <DatePickerField
                          value={dateInput}
                          onChange={setDateInput}
                          placeholder={t('search.filters.datePlaceholder')}
                          minimumDate={new Date(`${todayArtDateISO()}T00:00:00`)}
                          style={styles.input}
                        />
                      </View>
                  <View style={styles.scheduleRow}>
                    <View style={styles.hourBlock}>
                      <Text style={styles.hourLabel}>{t(halfDayOnlyFilter ? 'search.filters.checkIn' : 'search.filters.from')}</Text>
                      <View style={styles.hourControl}>
                        <TouchableOpacity
                          style={styles.hourBtn}
                          onPress={() => setFromHourInput((h) => Math.max(0, Math.min(h - 1, (halfDayOnlyFilter ? 24 : toHourInput) - 1)))}
                        >
                          <Ionicons name="remove" size={sc(14)} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.hourValue}>{String(fromHourInput).padStart(2, '0')}:00</Text>
                        <TouchableOpacity
                          style={styles.hourBtn}
                          onPress={() => setFromHourInput((h) => Math.min((halfDayOnlyFilter ? 24 : toHourInput) - 1, h + 1))}
                        >
                          <Ionicons name="add" size={sc(14)} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {halfDayOnlyFilter ? (
                      // A half-day always lasts 12 hours: there's no "until" to pick.
                      <View style={styles.hourBlock}>
                        <Text style={styles.hourLabel}>{t('search.filters.checkOut')}</Text>
                        <View style={styles.hourControl}>
                          <Text style={styles.hourValue}>{`${String((fromHourInput + 12) % 24).padStart(2, '0')}:00`}</Text>
                        </View>
                      </View>
                    ) : (
                    <View style={styles.hourBlock}>
                      <Text style={styles.hourLabel}>{t('search.filters.until')}</Text>
                      <View style={styles.hourControl}>
                        <TouchableOpacity
                          style={styles.hourBtn}
                          onPress={() => setToHourInput((h) => Math.max(fromHourInput + 1, h - 1))}
                        >
                          <Ionicons name="remove" size={sc(14)} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.hourValue}>{String(toHourInput % 24).padStart(2, '0')}:00</Text>
                        <TouchableOpacity
                          style={styles.hourBtn}
                          onPress={() => setToHourInput((h) => Math.min(24, Math.max(h + 1, fromHourInput + 1)))}
                        >
                          <Ionicons name="add" size={sc(14)} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    )}
                  </View>
                    </>
                  )}
                </>
              )}

              <Text style={styles.sectionLabel}>{t('search.filters.vehicle')}</Text>
              <View style={styles.chipsWrap}>
                <Chip
                  label={t('search.filters.anyVehicle')}
                  selected={vehicleTypeInput === null}
                  onPress={() => {
                    setVehicleTypeInput(null);
                    setVehicleIdInput(null);
                  }}
                />
                {myVehicles.map((vehicle) => (
                  <Chip
                    key={vehicle.id}
                    label={vehicleName(vehicle)}
                    selected={vehicleIdInput === vehicle.id}
                    onPress={() => {
                      setVehicleTypeInput(vehicle.type);
                      setVehicleIdInput(vehicle.id);
                    }}
                  />
                ))}
                {VEHICLE_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={t(VEHICLE_TYPE_LABEL_KEYS[type])}
                    selected={vehicleIdInput === null && vehicleTypeInput === type}
                    onPress={() => {
                      setVehicleTypeInput(type);
                      setVehicleIdInput(null);
                    }}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>
                {t(halfDayOnlyFilter ? 'search.filters.pricePerHalfDay' : stayOnly ? 'search.filters.pricePerDay' : 'search.filters.pricePerHour')}
              </Text>
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

              <Text style={styles.sectionLabel}>{t('search.filters.rating')}</Text>
              <View style={styles.chipsWrap}>
                <Chip label={t('search.filters.anyRating')} selected={minRatingInput === null} onPress={() => setMinRatingInput(null)} />
                {MIN_RATINGS.map((rating) => (
                  <Chip
                    key={rating}
                    label={t('search.filters.ratingValue', { rating: String(rating) })}
                    selected={minRatingInput === rating}
                    onPress={() => setMinRatingInput(rating)}
                  />
                ))}
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
              <TextInput
                style={styles.input}
                placeholder={t('search.filters.distancePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={distanceKmInput}
                onChangeText={setDistanceKmInput}
              />

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
