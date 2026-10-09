import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable, Image } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FAVORITE_RED } from '@/src/components/ParkingSpotCard';
import { formatShortDate } from '@/src/services/bookingDates';
import { PhotoGallery } from '@/src/components/PhotoGallery';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import {
  AvailabilityDatePickerField,
  hourlyAvailabilityFetcher,
  stayAvailabilityFetcher,
} from '@/src/components/AvailabilityDatePickerField';
import { formatStayBreakdown, getDriverVisiblePrice } from '@/src/services/utils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';
import { getParkingSpotDetail, formatScheduleForDisplay, getSpotPricePerHour, getMinPricePerHour } from '@/src/services/parkingService';
import { addOneDayISO, artDateFromISO, artMidnightForDate, nowArtHour, todayArtDateISO } from '@/src/services/dateUtils';
import { useAvailability } from '@/src/hooks/useAvailability';
import { getPublicProfileApi } from '@/src/api/auth';
import { getStayQuote, type FreeWindow, type StayQuote } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { VehicleType, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { ParkingSpot } from '@/src/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// What each amenity means for the driver, beyond its one-word label.
// Spots store "covered" as the Spanish word (see parkingService's mapping), the rest as keys.
const FEATURES: Record<string, { icon: IconName; labelKey: string; detailKey: string }> = {
  covered: { icon: 'home-outline', labelKey: 'spot.tag.covered', detailKey: 'spot.feature.covered' },
  Cubierta: { icon: 'home-outline', labelKey: 'spot.tag.covered', detailKey: 'spot.feature.covered' },
  uncovered: { icon: 'sunny-outline', labelKey: 'spot.tag.uncovered', detailKey: 'spot.feature.uncovered' },
  Descubierta: { icon: 'sunny-outline', labelKey: 'spot.tag.uncovered', detailKey: 'spot.feature.uncovered' },
  access247: { icon: 'time-outline', labelKey: 'spot.tag.access247', detailKey: 'spot.feature.access247' },
  secure: { icon: 'shield-checkmark-outline', labelKey: 'spot.tag.secure', detailKey: 'spot.feature.secure' },
};

/** "$9.180" */
function formatPesos(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-AR')}`;
}

/** 0 = Monday ... 6 = Sunday, on the Buenos Aires calendar (same as the schedule). */
function todayScheduleDay(): number {
  const art = new Date(Date.now() - 3 * 3600_000);
  return (art.getUTCDay() + 6) % 7;
}

/**
 * Extracts the Buenos Aires hour-of-day from an ISO datetime string.
 * Handles both offset-aware strings ("...T08:00:00-03:00") and UTC ("...T11:00:00Z").
 * Always returns the hour in ART (UTC-3).
 */
function hourFromISO(iso: string): number {
  const date = new Date(iso);
  // Convert to ART (UTC-3): subtract 3 hours from UTC
  const utcHour = date.getUTCHours();
  return ((utcHour - 3) + 24) % 24;
}

/**
 * Current hour in ART (UTC-3) with a 10-minute grace period.
 * If it's 13:05 → returns 13 (still bookable). If it's 13:11 → returns 14.
 * Returns -1 for future dates (nothing is in the past).
 */
function currentArtHourForDate(dateISO: string): number {
  const nowUTC = new Date();
  const nowArt = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);

  const todayISO = `${nowArt.getUTCFullYear()}-${String(nowArt.getUTCMonth() + 1).padStart(2, '0')}-${String(nowArt.getUTCDate()).padStart(2, '0')}`;

  if (dateISO > todayISO) return -1;   // future date: nothing is past
  if (dateISO < todayISO) return 24;   // past date: everything is past

  // It's today: return cutoff hour (with 10-min grace)
  const artMinutes = nowArt.getUTCHours() * 60 + nowArt.getUTCMinutes();
  const graceMinutes = artMinutes - 10; // subtract grace period
  return Math.ceil(graceMinutes / 60); // round up to next full hour
}

/**
 * Returns valid start hours from parking-service's real availability
 * (published schedule minus active bookings). A start hour `h` is valid if a
 * free window covers [h:00, h+durationHours:00] exactly — i.e. the window
 * starts at or before h:00 AND ends at or after h+durationHours:00.
 *
 * Uses epoch milliseconds from the raw ISO strings rather than truncating to
 * hours, so a free window that starts at e.g. 08:30 (left by a booking that
 * ends at 08:30) does NOT incorrectly expose 08:00 as bookable.
 */
function startHoursFromFreeWindows(freeWindows: FreeWindow[], durationHours: number): number[] {
  const hours: number[] = [];
  for (const window of freeWindows) {
    const windowStartMs = new Date(window.start).getTime();
    const windowEndMs = new Date(window.end).getTime();
    // Derive the ART calendar date from the window start to anchor midnight.
    const artDate = artDateFromISO(window.start);
    const artMidnightMs = artMidnightForDate(artDate);

    // First whole ART hour where slot start >= window start.
    const windowStartArtHour = hourFromISO(window.start);
    const windowStartMinute = new Date(window.start).getUTCMinutes();
    // If window starts exactly on the hour, it is a valid slot start;
    // otherwise bump to the next whole hour.
    const firstHour = windowStartMinute === 0 ? windowStartArtHour : windowStartArtHour + 1;

    for (let h = firstHour; ; h++) {
      const slotStartMs = artMidnightMs + h * 3600_000;
      const slotEndMs = artMidnightMs + (h + durationHours) * 3600_000;
      if (slotEndMs > windowEndMs) break;
      if (slotStartMs < windowStartMs) continue; // shouldn't happen after firstHour calc, but guard
      hours.push(h);
    }
  }
  return [...new Set(hours)].sort((a, b) => a - b);
}

// Same ceiling the old duration stepper had (1-12h).
const MAX_BOOKING_HOURS = 12;

// Check-in de una estadía: no depende del horario publicado (una cochera de
// solo estadía no tiene ninguno) -- cualquier hora del día es una opción
// válida.
const STAY_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

export default function SpotDetail() {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [owner, setOwner] = useState<{ name: string; avatarUrl: string | null } | null>(null);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const [selectedEndHour, setSelectedEndHour] = useState<number | null>(null);
  // Sólo importa para el precio cuando la cochera cobra distinto por
  // vehículo (spot.pricePerHourByVehicleType) -- ver el picker más abajo,
  // que sólo se muestra en ese caso.
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(null);
  // Sólo importa cuando la cochera ofrece los dos modos -- ahí el conductor
  // elige uno a la vez en vez de ver los dos formularios juntos (que
  // confundía sobre cuál total/botón corresponde a qué reserva).
  const [bookingMode, setBookingMode] = useState<'hourly' | 'stay'>('hourly');
  const user = useSessionStore((s) => s.user);
  const isFavorite = useFavoritesStore((s) => (id ? s.ids.has(id) : false));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  // Como stayStartDate más abajo: se deriva del override en vez de
  // sincronizarse con un useEffect, así nunca queda una fecha pasada
  // seleccionada (por el simple paso del tiempo) ni hace falta resetear
  // nada a mano al limpiar el calendario.
  const [selectedDateOverride, setSelectedDateOverride] = useState('');
  const selectedDateISO =
    selectedDateOverride && selectedDateOverride >= todayArtDateISO() ? selectedDateOverride : todayArtDateISO();

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  useEffect(() => {
    if (!spot) return;
    getPublicProfileApi(spot.ownerId)
      .then((profile) => setOwner({ name: profile.name, avatarUrl: profile.avatar_url }))
      .catch(() => {});
  }, [spot?.ownerId]);

  // Auto-refreshing availability: refetches on day change and every 30 s. The
  // fetch itself covers the whole day regardless of any chosen duration, so
  // there's no duration argument to pass here anymore.
  const { freeWindows, loading: availabilityLoading, error: availabilityError, refresh: refreshAvailability } =
    useAvailability(id, selectedDateISO, 1);

  // Refresh whenever the screen comes back into focus (e.g. after pressing "back"
  // from the confirm screen when there was a 409 conflict).
  useFocusEffect(
    useCallback(() => {
      refreshAvailability();
    }, [refreshAvailability]),
  );

  // Every hour that could start at least a 1-hour booking. When still
  // loading (no prior data) or in error (no prior data) this is [] so the
  // picker shows a spinner/error instead of stale or unchecked slots. The
  // schedule-only fallback has been intentionally removed: showing slots
  // without subtracting existing bookings causes 409 conflicts at confirmation.
  const allStartHours = useMemo(() => {
    if (!spot || availabilityLoading || freeWindows === null) return [];
    return startHoursFromFreeWindows(freeWindows, 1);
  }, [spot, freeWindows, availabilityLoading]);

  // Cutoff hour for the selected day (with 10-min grace). Hours strictly below
  // this are in the past and cannot be booked.
  const pastCutoffHour = useMemo(
    () => currentArtHourForDate(selectedDateISO),
    [selectedDateISO],
  );

  // Only show hours that are not in the past — past hours are never bookable and
  // displaying them (even greyed-out) confuses the user into thinking they can pick them.
  const bookableStartHours = useMemo(
    () => allStartHours.filter((h) => h >= pastCutoffHour),
    [allStartHours, pastCutoffHour],
  );

  // Derive the effective selected hour: if the current selection is no longer
  // in bookableStartHours (e.g. day changed, slot was just taken), fall back to
  // the first available hour. This replaces a useEffect+setState pattern with
  // pure derivation so there are no cascading renders.
  const effectiveStartHour: number | null = bookableStartHours.includes(selectedStartHour as number)
    ? selectedStartHour
    : bookableStartHours[0] ?? null;

  // Every end hour that keeps [effectiveStartHour, end) inside a single free
  // window, capped at a 12-hour booking (same ceiling the old duration
  // stepper had). Reuses startHoursFromFreeWindows itself instead of
  // re-deriving the window-overlap math: for a given trial duration d,
  // effectiveStartHour is a valid *start* of a d-hour booking exactly when
  // effectiveStartHour + d is a valid end hour.
  const bookableEndHours = useMemo(() => {
    if (!spot || availabilityLoading || freeWindows === null || effectiveStartHour === null) return [];
    const hours: number[] = [];
    for (let duration = 1; duration <= MAX_BOOKING_HOURS; duration++) {
      if (startHoursFromFreeWindows(freeWindows, duration).includes(effectiveStartHour)) {
        hours.push(effectiveStartHour + duration);
      }
    }
    return hours;
  }, [spot, freeWindows, availabilityLoading, effectiveStartHour]);

  const effectiveEndHour: number | null = bookableEndHours.includes(selectedEndHour as number)
    ? selectedEndHour
    : bookableEndHours[0] ?? null;

  const durationHours = effectiveStartHour !== null && effectiveEndHour !== null
    ? effectiveEndHour - effectiveStartHour
    : 0;

  // ── Estadía (rango de fechas + hora de check-in) ────────────────────────
  const [stayStartDateOverride, setStayStartDateOverride] = useState<string | null>(null);
  const [stayEndDateOverride, setStayEndDateOverride] = useState<string | null>(null);
  const [stayStartHour, setStayStartHour] = useState(nowArtHour);
  const [stayQuote, setStayQuote] = useState<StayQuote | null>(null);
  const [stayQuoteLoading, setStayQuoteLoading] = useState(false);
  const [stayQuoteError, setStayQuoteError] = useState<string | null>(null);

  // No antes de hoy ni antes de lo que el dueño configuró como
  // stayAvailableFrom -- igual que effectiveStartHour arriba, se deriva en
  // vez de sincronizarse con un useEffect, así un cambio en spot.stayAvailableFrom
  // (o el simple paso del tiempo) nunca deja el override en un valor inválido.
  const minStayStartDate = spot
    ? spot.stayAvailableFrom && spot.stayAvailableFrom > todayArtDateISO()
      ? spot.stayAvailableFrom
      : todayArtDateISO()
    : todayArtDateISO();
  const stayStartDate =
    stayStartDateOverride && stayStartDateOverride >= minStayStartDate ? stayStartDateOverride : minStayStartDate;

  // Al menos 1 día de estadía -- mismo criterio de "derivar, no sincronizar"
  // que minStayStartDate: si stayStartDate avanza más allá del fin elegido
  // (o el fin nunca se eligió), el mínimo se recalcula solo.
  const minStayEndDate = addOneDayISO(stayStartDate);
  const stayEndDate =
    stayEndDateOverride && stayEndDateOverride >= minStayEndDate ? stayEndDateOverride : minStayEndDate;

  // A spot that prices stays per vehicle type quotes by the type picked below (the first
  // one it accepts until the driver picks).
  const stayQuoteVehicleType: VehicleType | null = spot?.stayPricesByVehicleType
    ? spot.vehicleTypes.includes(selectedVehicleType as VehicleType)
      ? selectedVehicleType
      : spot.vehicleTypes[0] ?? null
    : null;

  useEffect(() => {
    if (!spot?.stayEnabled) return;
    let cancelled = false;
    setStayQuoteLoading(true);
    setStayQuoteError(null);
    getStayQuote(spot.id, stayStartDate, stayEndDate, stayStartHour, stayQuoteVehicleType)
      .then((quote) => {
        if (cancelled) return;
        setStayQuote(quote);
      })
      .catch((err) => {
        if (cancelled) return;
        setStayQuote(null);
        setStayQuoteError(err instanceof ApiError ? err.detail : t('spot.stay.quoteError'));
      })
      .finally(() => {
        if (!cancelled) setStayQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spot?.id, spot?.stayEnabled, stayStartDate, stayEndDate, stayStartHour, stayQuoteVehicleType]);

  if (!spot) return null;

  const isOwner = !!user && spot.ownerId === user.id;
  // Si la cochera cobra distinto por vehículo, hace falta uno elegido para
  // saber qué tarifa mostrar/cobrar -- se deriva del override en vez de
  // sincronizarse con un useEffect, mismo criterio que effectiveStartHour.
  const effectiveVehicleType: VehicleType | null = spot.vehicleTypes.includes(selectedVehicleType as VehicleType)
    ? selectedVehicleType
    : spot.vehicleTypes[0] ?? null;
  const rawPricePerHour = effectiveVehicleType !== null ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
  const visiblePricePerHour = rawPricePerHour !== null ? getDriverVisiblePrice(rawPricePerHour, commissionRatePercent) : null;
  const total = (visiblePricePerHour ?? 0) * durationHours;
  const canBook = effectiveStartHour !== null && effectiveEndHour !== null;

  const showHourly = spot.hourlyEnabled && (!spot.stayEnabled || bookingMode === 'hourly');
  const showStay = spot.stayEnabled && (!spot.hourlyEnabled || bookingMode === 'stay');
  const stayTotal = stayQuote ? getDriverVisiblePrice(stayQuote.amount / 100, commissionRatePercent) : null;
  const vehiclesLabel = spot.vehicleTypes.map((vt) => t(VEHICLE_TYPE_LABEL_KEYS[vt]).toLowerCase()).join(', ');
  const neighborhood = spot.address.split(',').map((part) => part.trim())[1];
  const scheduleLines = spot.hourlyEnabled ? formatScheduleForDisplay(spot.schedule) : [];
  const today = todayScheduleDay();
  const description = spot.descriptionKey ? t(spot.descriptionKey) : spot.description;
  const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

  const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background },
    scroll: { flex: 1, backgroundColor: colors.background },
    photoWrapper: { position: 'relative', backgroundColor: colors.background },
    favoriteBtn: {
      position: 'absolute', top: 14, right: 14,
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    body: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 32 },

    title: { fontSize: sc(22), fontWeight: '700', color: colors.text, letterSpacing: -0.2, lineHeight: sc(27) },
    metaRow: { marginTop: 8 },
    metaText: { fontSize: sc(13), color: colors.text },
    metaMuted: { fontSize: sc(13), color: colors.textSecondary },
    metaLink: { fontSize: sc(13), color: colors.teal, fontWeight: '600' },
    address: { fontSize: sc(13), color: colors.textSecondary, marginTop: 4, lineHeight: sc(17) },
    rates: { marginTop: 16, gap: 12 },
    rate: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    rateIcon: {
      width: sc(34), height: sc(34), borderRadius: sc(17),
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal + '1A',
    },
    rateText: { flex: 1 },
    rateHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    rateLabel: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    rateValue: { fontSize: sc(18), fontWeight: '700', color: colors.teal },
    rateUnit: { fontSize: sc(13), fontWeight: '400', color: colors.textSecondary },
    rateDetail: { fontSize: sc(13), color: colors.textSecondary, marginTop: 2, lineHeight: sc(18) },

    // colors.border barely shows on the gray background -- a translucent textSecondary
    // reads as a clear line in both themes.
    divider: { height: 1, backgroundColor: colors.textSecondary + '40', marginVertical: 22 },

    ownedNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    ownedNoteText: { fontSize: sc(14), fontWeight: '600', color: colors.teal },

    hostRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: sc(48), height: sc(48), borderRadius: sc(24), backgroundColor: colors.border },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal + '1F' },
    avatarInitial: { fontSize: sc(18), fontWeight: '700', color: colors.teal },
    hostText: { flex: 1 },
    hostLabel: { fontSize: sc(13), color: colors.textSecondary },
    hostName: { fontSize: sc(17), fontWeight: '600', color: colors.text, marginTop: 1 },

    sectionTitle: { fontSize: sc(17), fontWeight: '600', color: colors.text, marginBottom: 14 },
    feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
    featureText: { flex: 1 },
    featureTitle: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    featureDetail: { fontSize: sc(13), color: colors.textSecondary, marginTop: 2, lineHeight: sc(18) },
    paragraph: { fontSize: sc(15), color: colors.text, lineHeight: sc(22) },

    scheduleLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
    scheduleDays: { fontSize: sc(14), color: colors.text },
    scheduleHours: { fontSize: sc(14), color: colors.text, fontVariant: ['tabular-nums'] },
    scheduleClosed: { color: colors.textSecondary },
    scheduleToday: { fontWeight: '600' },
    todayTag: { fontSize: sc(12), fontWeight: '600', color: colors.teal },

    segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 20 },
    segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
    segmentItemActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    segmentText: { fontSize: sc(14), fontWeight: '600', color: colors.textSecondary },
    segmentTextActive: { color: colors.text },

    field: { marginBottom: 18 },
    fieldLabel: { fontSize: sc(14), fontWeight: '600', color: colors.text, marginBottom: 8 },
    dateInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, backgroundColor: colors.surface },
    hint: { fontSize: sc(13), color: colors.textSecondary, marginTop: 8, lineHeight: sc(18) },
    warn: { fontSize: sc(14), color: colors.warning },
    retry: { fontSize: sc(14), fontWeight: '600', color: colors.teal, textDecorationLine: 'underline' },

    chipRow: { flexDirection: 'row', gap: 8, paddingRight: 22 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
    chipText: { fontSize: sc(14), fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
    chipTextSelected: { color: colors.white },

    priceLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    priceLineText: { fontSize: sc(14), color: colors.text },
    breakdown: { fontSize: sc(13), color: colors.textSecondary, marginTop: 6 },

    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    footerInfo: { flex: 1 },
    footerTotal: { fontSize: sc(18), fontWeight: '700', color: colors.teal },
    footerWhen: { fontSize: sc(13), color: colors.textSecondary, marginTop: 2 },
    footerButton: { minWidth: 150 },
    editBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14,
    },
    editBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
  });

  // "¿Con qué vehículo vas?" -- for a spot that prices by vehicle type, the type decides the
  // rate shown (and carries over to the confirm screen). A render function, not a component,
  // for the same reason as hourChips below.
  function vehicleTypeChips() {
    if (spot!.vehicleTypes.length <= 1) return null;
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('spot.selectVehicleType')}</Text>
        <View style={styles.chipWrap}>
          {spot!.vehicleTypes.map((vt) => {
            const isSelected = vt === effectiveVehicleType;
            return (
              <TouchableOpacity
                key={vt}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setSelectedVehicleType(vt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {t(VEHICLE_TYPE_LABEL_KEYS[vt])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function hourChips(hours: number[], selected: number | null, onSelect: (h: number) => void) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {hours.map((h) => {
          const isSelected = h === selected;
          return (
            <TouchableOpacity
              key={h}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelect(h)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{pad(h)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  const leadPrice = spot.hourlyEnabled
    ? spot.pricePerHourByVehicleType
      ? t('spot.pricePerHour.from', { price: formatPesos(getDriverVisiblePrice(getMinPricePerHour(spot)!, commissionRatePercent)) })
      : formatPesos(visiblePricePerHour ?? 0)
    : null;

  const visible = (price: number) => formatPesos(getDriverVisiblePrice(price, commissionRatePercent));
  // "Auto $9.180 · Moto $4.000" -- each accepted type's own rate, for a spot priced per vehicle.
  const perVehicle = (priceOf: (vt: VehicleType) => number | undefined) =>
    spot.vehicleTypes
      .flatMap((vt) => {
        const price = priceOf(vt);
        return price ? [`${t(VEHICLE_TYPE_LABEL_KEYS[vt])} ${visible(price)}`] : [];
      })
      .join(' · ');
  const minStayDay = spot.stayPricesByVehicleType
    ? Math.min(...spot.vehicleTypes.map((vt) => spot.stayPricesByVehicleType?.[vt]?.day ?? Infinity))
    : spot.pricePerDay;

  // "$60.000 por semana · $200.000 por mes · Del 10/10/2026 al 20/10/2026 · Hasta 7 días" --
  // or, priced per vehicle, each type's daily rate first.
  const stayDetail = [
    spot.stayPricesByVehicleType ? perVehicle((vt) => spot.stayPricesByVehicleType?.[vt]?.day) : null,
    !spot.stayPricesByVehicleType && spot.pricePerWeek !== null
      ? t('spot.mode.perWeek', { price: formatPesos(getDriverVisiblePrice(spot.pricePerWeek, commissionRatePercent)) })
      : null,
    !spot.stayPricesByVehicleType && spot.pricePerMonth !== null
      ? t('spot.mode.perMonth', { price: formatPesos(getDriverVisiblePrice(spot.pricePerMonth, commissionRatePercent)) })
      : null,
    spot.stayAvailableUntil
      ? t('spot.mode.window', { from: formatShortDate(minStayStartDate), to: formatShortDate(spot.stayAvailableUntil) })
      : spot.stayAvailableFrom && spot.stayAvailableFrom > todayArtDateISO()
        ? t('spot.mode.from', { from: formatShortDate(spot.stayAvailableFrom) })
        : null,
    spot.maxStayDays ? t('spot.mode.maxDays', { days: String(spot.maxStayDays) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.photoWrapper}>
          <PhotoGallery photos={spot.photos} fallbackUri={spot.photoUrl} />
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={() => toggleFavorite(spot.id)}
            accessibilityLabel={t(isFavorite ? 'favorites.remove' : 'favorites.add')}
          >
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={sc(20)} color={isFavorite ? FAVORITE_RED : colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* The owner can browse their own spot from the driver side, but never rent it
              (booking-service rejects it too) -- the booking part is replaced by an edit
              button in the footer. */}
          {isOwner && (
            <View style={styles.ownedNote}>
              <Ionicons name="home" size={sc(16)} color={colors.teal} />
              <Text style={styles.ownedNoteText}>{t('spot.ownedByYou')}</Text>
            </View>
          )}

          <Text style={styles.title}>{spot.title}</Text>
          <Text style={styles.metaRow}>
            {spot.reviewCount > 0 ? (
              <>
                <Text style={styles.metaText}>★ {spot.rating.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</Text>
                <Text style={styles.metaMuted}>{'  ·  '}</Text>
                <Text style={styles.metaLink} onPress={() => router.push(`${group}/spot/${spot.id}/reviews`)}>
                  {t('spot.reviews.count', { count: String(spot.reviewCount) })}
                </Text>
              </>
            ) : (
              <Text style={styles.metaMuted}>{t('spot.reviews.none')}</Text>
            )}
            {neighborhood ? (
              <>
                <Text style={styles.metaMuted}>{'  ·  '}</Text>
                <Text style={styles.metaText}>{neighborhood}</Text>
              </>
            ) : null}
          </Text>
          <Text style={styles.address}>{spot.address}</Text>
          {/* How this spot can be booked -- by the hour, as a stay, or both -- with what each
              costs, before anything else. */}
          <View style={styles.rates}>
            {leadPrice && (
              <View style={styles.rate}>
                <View style={styles.rateIcon}>
                  <Ionicons name="time-outline" size={sc(18)} color={colors.teal} />
                </View>
                <View style={styles.rateText}>
                  <View style={styles.rateHead}>
                    <Text style={styles.rateLabel}>{t(spot.stayEnabled ? 'spot.mode.hourly' : 'spot.mode.hourlyOnly')}</Text>
                    <Text style={styles.rateValue}>
                      {leadPrice}<Text style={styles.rateUnit}>{` ${t('spot.unit.hour')}`}</Text>
                    </Text>
                  </View>
                  <Text style={styles.rateDetail}>
                    {spot.pricePerHourByVehicleType
                      ? perVehicle((vt) => spot.pricePerHourByVehicleType?.[vt])
                      : t('spot.mode.hourlyDetail')}
                  </Text>
                </View>
              </View>
            )}
            {spot.stayEnabled && minStayDay !== null && Number.isFinite(minStayDay) && (
              <View style={styles.rate}>
                <View style={styles.rateIcon}>
                  <Ionicons name="calendar-outline" size={sc(18)} color={colors.teal} />
                </View>
                <View style={styles.rateText}>
                  <View style={styles.rateHead}>
                    <Text style={styles.rateLabel}>{t(spot.hourlyEnabled ? 'spot.mode.stay' : 'spot.mode.stayOnly')}</Text>
                    <Text style={styles.rateValue}>
                      {spot.stayPricesByVehicleType
                        ? t('spot.pricePerHour.from', { price: visible(minStayDay) })
                        : visible(minStayDay)}
                      <Text style={styles.rateUnit}>{` ${t('spot.unit.day')}`}</Text>
                    </Text>
                  </View>
                  <Text style={styles.rateDetail}>{stayDetail}</Text>
                </View>
              </View>
            )}
          </View>

          {owner && (
            <>
              <View style={styles.divider} />
              <Pressable style={styles.hostRow} onPress={() => router.push(`${group}/profile/${spot.ownerId}?as=owner`)}>
                {owner.avatarUrl ? (
                  <Image source={{ uri: owner.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{owner.name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.hostText}>
                  <Text style={styles.hostLabel}>{t('spot.host.label')}</Text>
                  <Text style={styles.hostName}>{owner.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={sc(18)} color={colors.textSecondary} />
              </Pressable>
            </>
          )}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>{t('spot.section.features')}</Text>
          {spot.tags.filter((tag) => FEATURES[tag]).map((tag) => (
            <View key={tag} style={styles.feature}>
              <Ionicons name={FEATURES[tag].icon} size={sc(24)} color={colors.text} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{t(FEATURES[tag].labelKey)}</Text>
                <Text style={styles.featureDetail}>{t(FEATURES[tag].detailKey)}</Text>
              </View>
            </View>
          ))}
          {spot.vehicleTypes.length > 0 && (
            <View style={styles.feature}>
              <Ionicons name="car-sport-outline" size={sc(24)} color={colors.text} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{t('spot.feature.vehicles')}</Text>
                <Text style={styles.featureDetail}>{vehiclesLabel.charAt(0).toUpperCase() + vehiclesLabel.slice(1)}</Text>
              </View>
            </View>
          )}
          {(spot.requireVehicle || spot.pricePerHourByVehicleType || spot.stayPricesByVehicleType) && (
            <View style={styles.feature}>
              <Ionicons name="id-card-outline" size={sc(24)} color={colors.text} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{t('spot.feature.requiresVehicle')}</Text>
                <Text style={styles.featureDetail}>
                  {t(spot.requireVehicle ? 'spot.feature.requiresVehicle.detail' : 'spot.feature.requiresVehicle.pricedDetail')}
                </Text>
              </View>
            </View>
          )}

          {description ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t('spot.section.about')}</Text>
              <Text style={styles.paragraph}>{description}</Text>
            </>
          ) : null}

          {scheduleLines.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t('spot.section.schedule')}</Text>
              {scheduleLines.map((line) => {
                const isToday = today >= line.firstDay && today <= line.lastDay;
                const closed = line.hours === 'Cerrado';
                return (
                  <View key={line.dayRange} style={styles.scheduleLine}>
                    <Text style={[styles.scheduleDays, isToday && styles.scheduleToday]}>
                      {line.dayRange}
                      {isToday ? <Text style={styles.todayTag}>{`  ${t('spot.schedule.today')}`}</Text> : null}
                    </Text>
                    <Text style={[styles.scheduleHours, closed && styles.scheduleClosed, isToday && styles.scheduleToday]}>
                      {closed ? t('spot.schedule.closed') : line.hours}
                    </Text>
                  </View>
                );
              })}
            </>
          )}

          {!isOwner && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t('spot.section.book')}</Text>

              {spot.hourlyEnabled && spot.stayEnabled && (
                <View style={styles.segment}>
                  {(['hourly', 'stay'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.segmentItem, bookingMode === mode && styles.segmentItemActive]}
                      onPress={() => setBookingMode(mode)}
                    >
                      <Text style={[styles.segmentText, bookingMode === mode && styles.segmentTextActive]}>
                        {t(mode === 'hourly' ? 'owner.spot.hourly.enable' : 'owner.spot.stay.enable')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {showHourly && (
                <>
                  {/* Vehicle type picker -- sólo si el precio depende de cuál elijas */}
                  {spot.pricePerHourByVehicleType && vehicleTypeChips()}

                  {/* Date picker (calendar, coloreado por disponibilidad real) */}
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('spot.field.day')}</Text>
                    <AvailabilityDatePickerField
                      fetchAvailability={hourlyAvailabilityFetcher(spot.id)}
                      value={selectedDateISO}
                      onChange={setSelectedDateOverride}
                      placeholder={t('spot.datePlaceholder')}
                      minimumDate={new Date(`${todayArtDateISO()}T00:00:00`)}
                      style={styles.dateInput}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('spot.field.from')}</Text>
                    {availabilityLoading && freeWindows === null ? (
                      <ActivityIndicator size="small" color={colors.teal} style={{ alignSelf: 'flex-start' }} />
                    ) : availabilityError && freeWindows === null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.warn}>{t('spot.availabilityError')}</Text>
                        <TouchableOpacity onPress={refreshAvailability}>
                          <Text style={styles.retry}>{t('spot.availabilityRetry')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : bookableStartHours.length === 0 ? (
                      <Text style={styles.warn}>{t('spot.noSlotsToday')}</Text>
                    ) : (
                      hourChips(bookableStartHours, effectiveStartHour, (h) => {
                        setSelectedStartHour(h);
                        // Cambiar el inicio invalida el fin elegido si ya no entra en la
                        // misma ventana libre -- se limpia la selección manual para que
                        // caiga en el primer horario de fin válido.
                        setSelectedEndHour(null);
                      })
                    )}
                  </View>

                  {effectiveStartHour !== null && (
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>{t('spot.field.to')}</Text>
                      {hourChips(bookableEndHours, effectiveEndHour, setSelectedEndHour)}
                    </View>
                  )}

                  {canBook && visiblePricePerHour !== null && (
                    <View style={styles.priceLine}>
                      <Text style={styles.priceLineText}>
                        {t('spot.priceLine', { price: formatPesos(visiblePricePerHour), hours: String(durationHours) })}
                      </Text>
                      <Text style={styles.priceLineText}>{formatPesos(total)}</Text>
                    </View>
                  )}
                </>
              )}

              {showStay && (
                <>
                  {spot.stayPricesByVehicleType && vehicleTypeChips()}
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('spot.stay.startDate')}</Text>
                    <AvailabilityDatePickerField
                      fetchAvailability={stayAvailabilityFetcher(spot.id)}
                      value={stayStartDate}
                      onChange={setStayStartDateOverride}
                      placeholder={t('spot.datePlaceholder')}
                      minimumDate={new Date(`${minStayStartDate}T00:00:00`)}
                      style={styles.dateInput}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('spot.stay.endDate')}</Text>
                    <AvailabilityDatePickerField
                      fetchAvailability={stayAvailabilityFetcher(spot.id)}
                      value={stayEndDate}
                      onChange={setStayEndDateOverride}
                      placeholder={t('spot.datePlaceholder')}
                      minimumDate={new Date(`${minStayEndDate}T00:00:00`)}
                      style={styles.dateInput}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('spot.stay.startHour')}</Text>
                    {hourChips(STAY_HOUR_OPTIONS, stayStartHour, setStayStartHour)}
                    <Text style={styles.hint}>{t('spot.stay.startHour.hint')}</Text>
                  </View>
                  {stayQuoteLoading ? (
                    <ActivityIndicator size="small" color={colors.teal} style={{ alignSelf: 'flex-start' }} />
                  ) : stayQuoteError ? (
                    <Text style={styles.warn}>{stayQuoteError}</Text>
                  ) : stayQuote && stayTotal !== null ? (
                    <View style={styles.priceLine}>
                      <Text style={styles.priceLineText}>{formatStayBreakdown(stayQuote.breakdown)}</Text>
                      <Text style={styles.priceLineText}>{formatPesos(stayTotal)}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky footer: what it costs and the one action, always in reach. */}
      <View style={styles.footer}>
        {isOwner ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`${group}/spots/${spot.id}/edit`)}>
            <Ionicons name="pencil-outline" size={sc(16)} color={colors.white} />
            <Text style={styles.editBtnText}>{t('spot.editSpot')}</Text>
          </TouchableOpacity>
        ) : showHourly ? (
          <>
            <View style={styles.footerInfo}>
              <Text style={styles.footerTotal}>{canBook ? formatPesos(total) : '—'}</Text>
              {canBook && (
                <Text style={styles.footerWhen}>
                  {t('spot.footer.when', {
                    date: formatShortDate(selectedDateISO),
                    from: pad(effectiveStartHour!),
                    to: pad(effectiveEndHour!),
                  })}
                </Text>
              )}
            </View>
            <Button
              title={t('spot.book')}
              style={styles.footerButton}
              onPress={() =>
                router.push({
                  pathname: `${group}/booking/confirm`,
                  params: {
                    spotId: spot.id,
                    hours: String(durationHours),
                    startHour: String(effectiveStartHour),
                    endHour: String(effectiveEndHour),
                    bookingDate: selectedDateISO,
                    ...(effectiveVehicleType ? { vehicleType: effectiveVehicleType } : {}),
                  },
                })
              }
              disabled={!canBook}
            />
          </>
        ) : showStay ? (
          <>
            <View style={styles.footerInfo}>
              <Text style={styles.footerTotal}>{stayTotal !== null && !stayQuoteLoading ? formatPesos(stayTotal) : '—'}</Text>
              <Text style={styles.footerWhen}>
                {t('spot.footer.stay', { from: formatShortDate(stayStartDate), to: formatShortDate(stayEndDate) })}
              </Text>
            </View>
            <Button
              title={t('spot.book')}
              style={styles.footerButton}
              onPress={() =>
                router.push({
                  pathname: `${group}/booking/confirm-stay`,
                  params: {
                    spotId: spot.id,
                    startDate: stayStartDate,
                    endDate: stayEndDate,
                    startHour: String(stayStartHour),
                    ...(stayQuoteVehicleType ? { vehicleType: stayQuoteVehicleType } : {}),
                  },
                })
              }
              disabled={!stayQuote || stayQuoteLoading}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
