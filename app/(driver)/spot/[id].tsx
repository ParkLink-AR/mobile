import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { TAG_LABEL_KEYS, FAVORITE_RED, INSTANT_BOOKING_TAG } from '@/src/components/ParkingSpotCard';
import { RatingStars } from '@/src/components/RatingStars';
import { PhotoGallery } from '@/src/components/PhotoGallery';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { DatePickerField } from '@/src/components/DatePickerField';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';
import { getParkingSpotDetail, formatScheduleForDisplay, getSpotPricePerHour, getMinPricePerHour } from '@/src/services/parkingService';
import { artDateFromISO, artMidnightForDate, todayArtDateISO } from '@/src/services/dateUtils';
import { useAvailability } from '@/src/hooks/useAvailability';
import { getPublicProfileApi } from '@/src/api/auth';
import { getStayQuote, type FreeWindow, type StayQuote, type StayUnit } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { VehicleType, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { ParkingSpot } from '@/src/types';

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

export default function SpotDetail() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
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
    getPublicProfileApi(spot.ownerId).then((profile) => setOwnerName(profile.name)).catch(() => {});
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

  // ── Estadía (día/semana/mes) ────────────────────────────────────────────
  const [stayUnit, setStayUnit] = useState<StayUnit>('day');
  const [stayCount, setStayCount] = useState(1);
  const [stayStartDateOverride, setStayStartDateOverride] = useState<string | null>(null);
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

  useEffect(() => {
    if (!spot?.stayEnabled) return;
    let cancelled = false;
    setStayQuoteLoading(true);
    setStayQuoteError(null);
    getStayQuote(spot.id, stayStartDate, stayUnit, stayCount)
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
  }, [spot?.id, spot?.stayEnabled, stayStartDate, stayUnit, stayCount]);

  if (!spot) return null;

  const isOwner = !!user && spot.ownerId === user.id;
  // Si la cochera cobra distinto por vehículo, hace falta uno elegido para
  // saber qué tarifa mostrar/cobrar -- se deriva del override en vez de
  // sincronizarse con un useEffect, mismo criterio que effectiveStartHour.
  const effectiveVehicleType: VehicleType | null = spot.vehicleTypes.includes(selectedVehicleType as VehicleType)
    ? selectedVehicleType
    : spot.vehicleTypes[0] ?? null;
  const rawPricePerHour = effectiveVehicleType !== null ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
  const visiblePricePerHour = rawPricePerHour !== null ? getDriverVisiblePrice(rawPricePerHour) : null;
  const total = (visiblePricePerHour ?? 0) * durationHours;
  const canBook = effectiveStartHour !== null && effectiveEndHour !== null;

  const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    photoWrapper: { position: 'relative' },
    favoriteBtn: {
      position: 'absolute', top: 14, right: 14,
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    photo: { width: '100%', height: 200 },
    body: { padding: 16, gap: 14 },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 6,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 },
    ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    ownerRowText: { flex: 1, fontSize: 13, color: colors.textSecondary },
    row: { marginTop: 6 },
    total: { ...typography.h2, color: colors.teal, marginVertical: 4 },
    ownerBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.teal + '18',
      borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.teal + '44',
    },
    ownerBannerText: { fontSize: 14, fontWeight: '600', color: colors.teal, flex: 1 },
    editBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.teal, borderRadius: 10,
      paddingVertical: 13, paddingHorizontal: 16, justifyContent: 'center',
    },
    editBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 },

    // Mode switch (por hora / estadía)
    modeToggleRow: { flexDirection: 'row', gap: 8 },
    modeToggle: {
      flex: 1, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    },
    modeToggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    modeToggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    modeToggleTextActive: { color: colors.surface, fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },

    // Duration selector
    durationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    durationBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    },
    durationBtnDisabled: { backgroundColor: colors.teal + '44' },
    durationBtnText: { fontSize: 20, fontWeight: '700', color: colors.white },
    durationValue: { ...typography.h2, minWidth: 40, textAlign: 'center' },

    // Calendar date field (same box style as the publish/edit forms)
    dateInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 12,
    },

    // Slot picker
    slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotChip: {
      paddingVertical: 8, paddingHorizontal: 14,
      borderRadius: 20, borderWidth: 1,
      borderColor: colors.teal,
      backgroundColor: colors.surface,
    },
    slotChipSelected: { backgroundColor: colors.teal },
    slotChipText: { fontSize: 14, fontWeight: '500', color: colors.teal },
    slotChipTextSelected: { color: colors.white },
    noSlotsText: { ...typography.body, color: colors.warning },

    // Estadía
    toggleRowStay: { flexDirection: 'row', gap: 8 },
    stayUnitChip: {
      flex: 1, alignItems: 'center', paddingVertical: 8,
      borderRadius: 10, borderWidth: 1, borderColor: colors.teal,
      backgroundColor: colors.surface,
    },
    stayUnitChipSelected: { backgroundColor: colors.teal },
    stayUnitChipText: { fontSize: 13, fontWeight: '600', color: colors.teal },
    stayUnitChipTextSelected: { color: colors.white },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.container}>
      <View style={styles.photoWrapper}>
        <PhotoGallery photos={spot.photos} height={200} fallbackUri={spot.photoUrl} />
        <TouchableOpacity style={styles.favoriteBtn} onPress={() => toggleFavorite(spot.id)}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? FAVORITE_RED : colors.white}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <View style={styles.infoCard}>
          <Text style={typography.h1}>{spot.title}</Text>
          <TouchableOpacity onPress={() => router.push(`${group}/spot/${spot.id}/reviews`)}>
            <RatingStars rating={spot.rating} count={spot.reviewCount} />
          </TouchableOpacity>
          {!!ownerName && (
            <TouchableOpacity
              style={styles.ownerRow}
              onPress={() => router.push(`${group}/profile/${spot.ownerId}?as=owner`)}
            >
              <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.ownerRowText}>{t('spot.postedBy', { name: ownerName })}</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <View style={styles.tagRow}>
            {spot.tags.map((tag) => (
              <Chip key={tag} label={TAG_LABEL_KEYS[tag] ? t(TAG_LABEL_KEYS[tag]) : tag} />
            ))}
            {spot.vehicleTypes.map((vt) => (
              <Chip key={vt} label={t(VEHICLE_TYPE_LABEL_KEYS[vt])} />
            ))}
            <Chip
              icon={spot.instantBooking ? INSTANT_BOOKING_TAG.instant.iconName : INSTANT_BOOKING_TAG.approval.iconName}
              label={t(spot.instantBooking ? INSTANT_BOOKING_TAG.instant.i18nKey : INSTANT_BOOKING_TAG.approval.i18nKey)}
            />
          </View>
        </View>

        <View style={styles.card}>
          {(spot.descriptionKey || spot.description) ? (
            <Row
              label={t('spot.description')}
              value={spot.descriptionKey ? t(spot.descriptionKey) : spot.description}
            />
          ) : null}
          <Row label={t('spot.address')} value={spot.address} />
          {spot.hourlyEnabled && (
            <>
              <ScheduleRow label={t('spot.available')} schedule={spot.schedule} />
              <Row
                label={t('spot.pricePerHour')}
                value={
                  spot.pricePerHourByVehicleType
                    ? t('spot.pricePerHour.variesByVehicle', {
                        price: String(getDriverVisiblePrice(getMinPricePerHour(spot)!)),
                      })
                    : t('spot.pricePerHour.withUnit', { price: String(visiblePricePerHour) })
                }
              />
            </>
          )}
        </View>

        {isOwner ? (
          <>
            <View style={styles.ownerBanner}>
              <Ionicons name="home-outline" size={18} color={colors.teal} />
              <Text style={styles.ownerBannerText}>{t('spot.ownedByYou')}</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`${group}/spots/${spot.id}/edit`)}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.white} />
              <Text style={styles.editBtnText}>{t('spot.editSpot')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {spot.hourlyEnabled && spot.stayEnabled && (
              <View style={styles.modeToggleRow}>
                <Pressable
                  style={[styles.modeToggle, bookingMode === 'hourly' && styles.modeToggleActive]}
                  onPress={() => setBookingMode('hourly')}
                >
                  <Text style={bookingMode === 'hourly' ? styles.modeToggleTextActive : styles.modeToggleText}>
                    {t('owner.spot.hourly.enable')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeToggle, bookingMode === 'stay' && styles.modeToggleActive]}
                  onPress={() => setBookingMode('stay')}
                >
                  <Text style={bookingMode === 'stay' ? styles.modeToggleTextActive : styles.modeToggleText}>
                    {t('owner.spot.stay.enable')}
                  </Text>
                </Pressable>
              </View>
            )}

            {spot.hourlyEnabled && (!spot.stayEnabled || bookingMode === 'hourly') && (
              <>
                {/* Vehicle type picker -- sólo si el precio depende de cuál elijas */}
                {spot.pricePerHourByVehicleType && spot.vehicleTypes.length > 1 && (
                  <View style={styles.card}>
                    <Text style={styles.sectionLabel}>{t('spot.selectVehicleType')}</Text>
                    <View style={styles.slotRow}>
                      {spot.vehicleTypes.map((vt) => {
                        const isSelected = vt === effectiveVehicleType;
                        return (
                          <TouchableOpacity
                            key={vt}
                            style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                            onPress={() => setSelectedVehicleType(vt)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.slotChipText, isSelected && styles.slotChipTextSelected]}>
                              {t(VEHICLE_TYPE_LABEL_KEYS[vt])}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Date picker (calendar) */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>{t('spot.selectDay')}</Text>
                  <DatePickerField
                    value={selectedDateISO}
                    onChange={setSelectedDateOverride}
                    placeholder={t('spot.datePlaceholder')}
                    minimumDate={new Date(`${todayArtDateISO()}T00:00:00`)}
                    style={styles.dateInput}
                  />
                </View>

                {/* Start time slot picker */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>{t('spot.selectStartTime')}</Text>
                  {availabilityLoading && freeWindows === null ? (
                    <ActivityIndicator size="small" color={colors.teal} />
                  ) : availabilityError && freeWindows === null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.noSlotsText}>{t('spot.availabilityError')}</Text>
                      <TouchableOpacity onPress={refreshAvailability}>
                        <Text style={[styles.slotChipText, { textDecorationLine: 'underline' }]}>
                          {t('spot.availabilityRetry')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : bookableStartHours.length === 0 ? (
                    <Text style={styles.noSlotsText}>{t('spot.noSlotsToday')}</Text>
                  ) : (
                    <View style={styles.slotRow}>
                      {bookableStartHours.map((h) => {
                        const isSelected = h === effectiveStartHour;
                        return (
                          <TouchableOpacity
                            key={h}
                            style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                            onPress={() => {
                              setSelectedStartHour(h);
                              // Cambiar el inicio invalida el fin elegido si
                              // ya no entra en la misma ventana libre -- se
                              // recalcula solo (effectiveEndHour), pero
                              // limpiamos la selección manual para que caiga
                              // en el primer horario de fin válido en vez de
                              // en uno que por casualidad coincide en valor
                              // pero pertenece a otra ventana.
                              setSelectedEndHour(null);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.slotChipText,
                              isSelected && styles.slotChipTextSelected,
                            ]}>
                              {String(h).padStart(2, '0')}:00
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* End time slot picker */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>{t('spot.selectEndTime')}</Text>
                  {effectiveStartHour === null ? (
                    <Text style={styles.noSlotsText}>{t('spot.selectStartTimeFirst')}</Text>
                  ) : (
                    <View style={styles.slotRow}>
                      {bookableEndHours.map((h) => {
                        const isSelected = h === effectiveEndHour;
                        return (
                          <TouchableOpacity
                            key={h}
                            style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                            onPress={() => setSelectedEndHour(h)}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.slotChipText,
                              isSelected && styles.slotChipTextSelected,
                            ]}>
                              {String(h % 24).padStart(2, '0')}:00
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <Text style={styles.total}>{t('spot.total', { hours: String(durationHours), total: String(total) })}</Text>
                <Button
                  title={t('spot.bookNow')}
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
            )}

            {spot.stayEnabled && (!spot.hourlyEnabled || bookingMode === 'stay') && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>{t('spot.stay.section')}</Text>

                <Text style={styles.fieldLabel}>{t('spot.stay.unit')}</Text>
                <View style={styles.toggleRowStay}>
                  {(['day', 'week', 'month'] as StayUnit[]).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.stayUnitChip, stayUnit === unit && styles.stayUnitChipSelected]}
                      onPress={() => setStayUnit(unit)}
                    >
                      <Text style={[styles.stayUnitChipText, stayUnit === unit && styles.stayUnitChipTextSelected]}>
                        {t(`spot.stay.unit.${unit}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('spot.stay.count')}</Text>
                <View style={styles.durationRow}>
                  <TouchableOpacity
                    style={[styles.durationBtn, stayCount <= 1 && styles.durationBtnDisabled]}
                    onPress={() => setStayCount((c) => Math.max(1, c - 1))}
                    disabled={stayCount <= 1}
                  >
                    <Text style={styles.durationBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.durationValue}>{stayCount}</Text>
                  <TouchableOpacity
                    style={styles.durationBtn}
                    onPress={() => setStayCount((c) => c + 1)}
                  >
                    <Text style={styles.durationBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>{t('spot.stay.startDate')}</Text>
                <DatePickerField
                  value={stayStartDate}
                  onChange={setStayStartDateOverride}
                  placeholder={t('spot.datePlaceholder')}
                  minimumDate={new Date(`${minStayStartDate}T00:00:00`)}
                  style={styles.dateInput}
                />

                {stayQuoteLoading ? (
                  <ActivityIndicator size="small" color={colors.teal} />
                ) : stayQuoteError ? (
                  <Text style={styles.noSlotsText}>{stayQuoteError}</Text>
                ) : stayQuote ? (
                  <Text style={styles.total}>
                    {t('spot.stay.total', { total: String(Math.round(getDriverVisiblePrice(stayQuote.amount / 100))) })}
                  </Text>
                ) : null}

                <Button
                  title={t('spot.stay.bookNow')}
                  onPress={() =>
                    router.push({
                      pathname: `${group}/booking/confirm-stay`,
                      params: {
                        spotId: spot.id,
                        startDate: stayStartDate,
                        unit: stayUnit,
                        count: String(stayCount),
                      },
                    })
                  }
                  disabled={!stayQuote || stayQuoteLoading}
                />
              </View>
            )}
          </>
        )}
      </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const typography = useTypography();
  const styles = StyleSheet.create({ row: { marginTop: 6 } });
  return (
    <View style={styles.row}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

function ScheduleRow({ label, schedule }: { label: string; schedule: ParkingSpot['schedule'] }) {
  const typography = useTypography();
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: { marginTop: 6 },
    line: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    dayRange: { ...typography.body, minWidth: 90 },
    closed: { color: colors.textSecondary },
  });
  const lines = formatScheduleForDisplay(schedule);
  return (
    <View style={styles.row}>
      <Text style={typography.caption}>{label}</Text>
      {lines.map((line) => (
        <View key={line.dayRange} style={styles.line}>
          <Text style={styles.dayRange}>{line.dayRange}</Text>
          <Text style={[typography.body, line.hours === 'Cerrado' && styles.closed]}>{line.hours}</Text>
        </View>
      ))}
    </View>
  );
}
