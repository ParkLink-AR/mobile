import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable, Image } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FAVORITE_RED } from '@/src/components/ParkingSpotCard';
import { formatShortDate, formatWeekdayDayMonth } from '@/src/services/bookingDates';
import { PhotoGallery } from '@/src/components/PhotoGallery';
import { Button } from '@/src/components/Button';
import { PendingBalanceBanner } from '@/src/components/booking/PendingBalanceBanner';
import { useMyDebts } from '@/src/services/debts';
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
import { addDaysISO, addOneDayISO, nowArtHour, todayArtDateISO } from '@/src/services/dateUtils';
import {
  defaultEnd,
  defaultStart,
  durationHours as rangeDurationHours,
  endBounds,
  endDateOf,
  endOnDate,
  barDomain,
  freeRangesIn,
  startDateOf,
  endRangeOnDate,
  formatArtTime,
  formatRanges,
  freeRangesOnDay,
  isInRanges,
  MIN_BOOKING_MINUTES,
  pickStartFromTap,
  resolveEndInput,
  resolveStartInput,
  timeToDigits,
  toArtISO,
  validStartRanges,
} from '@/src/services/bookingRange';
import { TimeEntrySheet } from '@/src/components/TimeEntrySheet';
import { DayAvailabilityBar } from '@/src/components/DayAvailabilityBar';
import { MonthAvailabilitySheet } from '@/src/components/MonthAvailabilitySheet';
import { findFirstFreeStart, useAvailability } from '@/src/hooks/useAvailability';
import { findFirstFreeStayStart } from '@/src/services/stayAvailability';
import { getPublicProfileApi } from '@/src/api/auth';
import { getStayQuote, type StayQuote } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { VehicleType, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { ParkingSpot } from '@/src/types';
import { ReportButton } from '@/src/components/ReportButton';

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

/** "1,5" / "2" -- horas con coma decimal, sin ceros de más. */
function formatHours(hours: number): string {
  return String(Math.round(hours * 100) / 100).replace('.', ',');
}

/** El mismo horario de `endMs` pero sobre `dateISO` (con 24:00 como la medianoche con la que termina ese día). */
function endOnSameTime(dateISO: string, endMs: number): number {
  const [hours, minutes] = formatArtTime(endMs, true).split(':').map(Number);
  return endOnDate(dateISO, hours, minutes);
}

/** "14/10" */
function formatDayMonth(dateISO: string): string {
  const [, month, day] = dateISO.split('-');
  return `${day}/${month}`;
}

/** 0 = Monday ... 6 = Sunday, on the Buenos Aires calendar (same as the schedule). */
function todayScheduleDay(): number {
  const art = new Date(Date.now() - 3 * 3600_000);
  return (art.getUTCDay() + 6) % 7;
}

// Cuántos días desde el de inicio se le pide disponibilidad a parking-service (su tope por pedido):
// es también lo más lejos que puede terminar una reserva por hora.
const MAX_BOOKING_SPAN_DAYS = 14;

// Check-in de una estadía: no depende del horario publicado (una cochera de
// solo estadía no tiene ninguno) -- cualquier hora del día es una opción
// válida.
const STAY_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

export default function SpotDetail() {
  const colors = useThemeColors();
  const { pending: pendingBalance } = useMyDebts();
  const insets = useSafeAreaInsets();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  useLanguage();
  const group = `/${useSegments()[0]}`;
  // "Volver a reservar" opens the spot set up like the booking it repeats: same kind (hourly
  // or stay), same length (hours, or days for a stay) and same vehicle type. The day still
  // falls on the first free one, like any other visit.
  const { id, mode: repeatMode, hours: repeatHoursParam, days: repeatDaysParam, vehicleType: repeatVehicleType } =
    useLocalSearchParams<{ id: string; mode?: string; hours?: string; days?: string; vehicleType?: string }>();
  const repeatHours = Number(repeatHoursParam) > 0 ? Number(repeatHoursParam) : null;
  const repeatDays = Number(repeatDaysParam) > 0 ? Math.round(Number(repeatDaysParam)) : null;
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [owner, setOwner] = useState<{ name: string; avatarUrl: string | null } | null>(null);
  // Inicio y fin de la reserva por hora, en epoch-ms. Sólo guardan lo que el conductor tocó: lo que
  // se muestra sale de effectiveStartMs/effectiveEndMs más abajo, que caen en un valor válido solos.
  const [startMsOverride, setStartMsOverride] = useState<number | null>(null);
  const [endMsOverride, setEndMsOverride] = useState<number | null>(null);
  const [endDateNotice, setEndDateNotice] = useState(false);
  const [timeSheet, setTimeSheet] = useState<'start' | 'end' | null>(null);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  // Sólo importa para el precio cuando la cochera cobra distinto por
  // vehículo (spot.pricePerHourByVehicleType) -- ver el picker más abajo,
  // que sólo se muestra en ese caso.
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(
    () => (repeatVehicleType as VehicleType | undefined) ?? null,
  );
  // Sólo importa cuando la cochera ofrece los dos modos -- ahí el conductor
  // elige uno a la vez en vez de ver los dos formularios juntos (que
  // confundía sobre cuál total/botón corresponde a qué reserva).
  const [bookingMode, setBookingMode] = useState<'hourly' | 'stay'>(() => (repeatMode === 'stay' ? 'stay' : 'hourly'));
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

  // Auto-refreshing availability: refetches on day change and every 30 s. Trae el día de inicio y
  // los siguientes (hasta MAX_BOOKING_SPAN_DAYS), con las ventanas que se tocan ya unidas, para poder
  // reservar cruzando la medianoche o por varios días.
  // La disponibilidad se pide desde hoy mientras el inicio sea hoy o mañana: así elegir en la barra un horario de
  // pasada la medianoche cambia el día sin volver a cargar. Más lejos, desde el día elegido.
  const availabilityAnchorISO =
    selectedDateISO <= addDaysISO(todayArtDateISO(), 1) ? todayArtDateISO() : selectedDateISO;
  const { windows, loading: availabilityLoading, error: availabilityError, refresh: refreshAvailability } =
    useAvailability(id, availabilityAnchorISO, MAX_BOOKING_SPAN_DAYS);

  // Refresh whenever the screen comes back into focus (e.g. after pressing "back"
  // from the confirm screen when there was a 409 conflict).
  useFocusEffect(
    useCallback(() => {
      refreshAvailability();
    }, [refreshAvailability]),
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Lo libre del día de inicio, al minuto. Mientras carga (o si falló sin datos previos) es []: no se ofrece
  // nada sin restar las reservas existentes, porque terminaría en un 409 al confirmar.
  const freeToday = useMemo(
    () => (!spot || windows === null ? [] : freeRangesOnDay(windows, selectedDateISO, nowMs)),
    [spot, windows, selectedDateISO, nowMs],
  );
  const startRanges = useMemo(
    () => (!spot || windows === null ? [] : validStartRanges(windows, selectedDateISO, nowMs)),
    [spot, windows, selectedDateISO, nowMs],
  );

  // Al abrir la cochera, si hoy ya no queda nada libre, se salta solo al primer día y horario con lugar en vez de
  // mostrar "no hay horarios" -- una sola vez, y sólo si el conductor todavía no eligió un día. Se busca hacia
  // adelante de a 14 días (lo que ya está cargado no alcanza si la cochera está llena varias semanas).
  const firstFreeLookup = useRef<'idle' | 'done'>('idle');
  const todayHasNoStart = !!spot?.hourlyEnabled && windows !== null && selectedDateOverride === '' && startRanges.length === 0;
  useEffect(() => {
    if (!todayHasNoStart || firstFreeLookup.current === 'done') return;
    // Sin cancelar en el cleanup: en modo estricto el efecto corre dos veces y la segunda ya no busca.
    firstFreeLookup.current = 'done';
    findFirstFreeStart(id, todayArtDateISO(), Date.now())
      .then((startMs) => {
        if (startMs === null) return;
        // Si mientras tanto eligió un día a mano, se respeta lo suyo.
        setSelectedDateOverride((prev) => prev || startDateOf(startMs));
        setStartMsOverride((prev) => prev ?? startMs);
      })
      .catch(() => {
        // Sin la búsqueda queda el aviso de siempre; el conductor puede elegir otro día a mano.
      });
  }, [todayHasNoStart, id]);

  // Si el inicio elegido ya no está libre (cambió el día, se lo ganaron), cae en el sugerido. Derivado
  // en vez de sincronizado con un useEffect, para no encadenar renders.
  const effectiveStartMs: number | null =
    startMsOverride !== null && isInRanges(startRanges, startMsOverride)
      ? startMsOverride
      : defaultStart(startRanges, nowMs);

  // Entre cuándo puede terminar: hasta donde acaba la ventana libre que contiene el inicio, sea el mismo
  // día o varios después.
  const endLimits = useMemo(
    () => (windows === null || effectiveStartMs === null ? null : endBounds(windows, effectiveStartMs)),
    [windows, effectiveStartMs],
  );

  const effectiveEndMs: number | null =
    endMsOverride !== null && endLimits !== null && isInRanges([endLimits], endMsOverride)
      ? endMsOverride
      : effectiveStartMs !== null
        ? repeatHours !== null && endLimits !== null
          ? // Repeating a booking: as long as last time, or as far as it's free.
            Math.max(endLimits.startMs, Math.min(effectiveStartMs + repeatHours * 60 * 60 * 1000, endLimits.endMs))
          : defaultEnd(endLimits, effectiveStartMs)
        : null;

  const endDateISO = effectiveEndMs !== null ? endDateOf(effectiveEndMs) : selectedDateISO;

  // Lo que dibuja la barra: las próximas 24 h desde ahora (o el día de inicio entero si cae más lejos).
  const barWindow = barDomain(selectedDateISO, effectiveStartMs, nowMs);
  const freeInBar = useMemo(
    () => (windows === null ? [] : freeRangesIn(windows, barWindow)),
    // barWindow es un objeto nuevo en cada render: se compara por sus extremos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windows, barWindow.startMs, barWindow.endMs],
  );

  const durationHours =
    effectiveStartMs !== null && effectiveEndMs !== null ? rangeDurationHours(effectiveStartMs, effectiveEndMs) : 0;

  function handleStartDateChange(dateISO: string) {
    setSelectedDateOverride(dateISO);
    setStartMsOverride(null);
    setEndMsOverride(null);
    setEndDateNotice(false);
  }

  function handleStartTimeConfirm(ms: number) {
    setStartMsOverride(ms);
    // Cambiar el inicio puede dejar el fin elegido fuera de la ventana libre -- se limpia para que
    // caiga en el fin sugerido.
    setEndMsOverride(null);
    setEndDateNotice(false);
    setTimeSheet(null);
  }

  // Cambiar el día de fin conserva la hora si ese día la tiene libre; si no, la más cercana que entre. Si
  // ese día no se alcanza sin pisar otra reserva, no cambia nada y avisa.
  function handleEndDateChange(dateISO: string) {
    const range = endLimits ? endRangeOnDate(endLimits, dateISO) : null;
    if (!range || effectiveEndMs === null) {
      setEndDateNotice(true);
      return;
    }
    const sameTimeOfDay = endOnSameTime(dateISO, effectiveEndMs);
    setEndMsOverride(Math.min(Math.max(sameTimeOfDay, range.startMs), range.endMs));
    setEndDateNotice(false);
  }

  // Elegir un inicio en la barra (o en el detalle por día): puede caer en otro día -- entonces cambia también "Desde".
  function pickStartAt(ms: number) {
    setSelectedDateOverride(startDateOf(ms));
    handleStartTimeConfirm(ms);
  }

  function handleBarPick(tapMs: number) {
    if (windows === null) return;
    const ms = pickStartFromTap(validStartRanges(windows, startDateOf(tapMs), nowMs), tapMs);
    if (ms !== null) pickStartAt(ms);
  }

  function handleEndTimeConfirm(ms: number) {
    setEndMsOverride(ms);
    setEndDateNotice(false);
    setTimeSheet(null);
  }

  // Lo que dicen las hojas de hora: qué instante es lo tipeado (o por qué no sirve) y qué hay libre.
  function resolveStartTyped(hours: number, minutes: number) {
    const result = resolveStartInput(startRanges, selectedDateISO, hours, minutes);
    return 'ms' in result ? result : { error: t('spot.time.unavailable') };
  }

  function resolveEndTyped(hours: number, minutes: number) {
    if (!endLimits) return { error: t('spot.time.unavailable') };
    const result = resolveEndInput(endLimits, endDateISO, hours, minutes);
    if ('ms' in result) return result;
    return {
      error:
        result.error === 'tooShort'
          ? t('spot.time.tooShort', { minutes: String(MIN_BOOKING_MINUTES) })
          : t('spot.time.unavailable'),
    };
  }

  // ── Estadía (rango de fechas + hora de check-in) ────────────────────────
  const [stayStartDateOverride, setStayStartDateOverride] = useState<string | null>(null);
  const [stayEndDateOverride, setStayEndDateOverride] = useState<string | null>(null);
  const [stayStartHour, setStayStartHour] = useState(nowArtHour);
  const [stayQuote, setStayQuote] = useState<StayQuote | null>(null);
  const [stayQuoteLoading, setStayQuoteLoading] = useState(false);
  const [stayQuoteError, setStayQuoteError] = useState<string | null>(null);
  // The quoted dates overlap another booking (409) -- as opposed to any other quote error.
  const [stayQuoteTaken, setStayQuoteTaken] = useState(false);

  // No antes de hoy ni antes de lo que el dueño configuró como
  // stayAvailableFrom -- igual que effectiveStartMs arriba, se deriva en
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
  // Repeating a stay suggests the same number of days.
  const suggestedStayEndDate = repeatDays !== null ? addDaysISO(stayStartDate, repeatDays) : minStayEndDate;
  const stayEndDate =
    stayEndDateOverride && stayEndDateOverride >= minStayEndDate ? stayEndDateOverride : suggestedStayEndDate;

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
    setStayQuoteTaken(false);
    getStayQuote(spot.id, stayStartDate, stayEndDate, stayStartHour, stayQuoteVehicleType)
      .then((quote) => {
        if (cancelled) return;
        setStayQuote(quote);
      })
      .catch((err) => {
        if (cancelled) return;
        setStayQuote(null);
        setStayQuoteError(err instanceof ApiError ? err.detail : t('spot.stay.quoteError'));
        setStayQuoteTaken(err instanceof ApiError && err.status === 409);
      })
      .finally(() => {
        if (!cancelled) setStayQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spot?.id, spot?.stayEnabled, stayStartDate, stayEndDate, stayStartHour, stayQuoteVehicleType]);

  // Lo mismo que con las horas: si la estadía que se propone al abrir (hoy -> mañana) ya está tomada, se salta sola a
  // las primeras fechas libres en vez de mostrar el aviso -- una sola vez, y sólo si el conductor no eligió fechas.
  const firstFreeStayLookup = useRef<'idle' | 'done'>('idle');
  const defaultStayTaken =
    !!spot?.stayEnabled && stayQuoteTaken && stayStartDateOverride === null && stayEndDateOverride === null;
  useEffect(() => {
    if (!defaultStayTaken || firstFreeStayLookup.current === 'done' || !spot) return;
    firstFreeStayLookup.current = 'done';
    // Desde el día siguiente al propuesto: ése ya se sabe que no entra.
    findFirstFreeStayStart(spot.id, addOneDayISO(stayStartDate))
      .then((startDate) => {
        if (startDate === null) return;
        setStayStartDateOverride((prev) => prev ?? startDate);
        setStayEndDateOverride((prev) => prev ?? addOneDayISO(startDate));
      })
      .catch(() => {
        // Sin la búsqueda queda el aviso de siempre; las fechas se pueden elegir a mano.
      });
  }, [defaultStayTaken, spot, stayStartDate]);

  if (!spot) return null;

  const isOwner = !!user && spot.ownerId === user.id;
  // Si la cochera cobra distinto por vehículo, hace falta uno elegido para
  // saber qué tarifa mostrar/cobrar -- se deriva del override en vez de
  // sincronizarse con un useEffect, mismo criterio que effectiveStartMs.
  const effectiveVehicleType: VehicleType | null = spot.vehicleTypes.includes(selectedVehicleType as VehicleType)
    ? selectedVehicleType
    : spot.vehicleTypes[0] ?? null;
  const rawPricePerHour = effectiveVehicleType !== null ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
  const visiblePricePerHour = rawPricePerHour !== null ? getDriverVisiblePrice(rawPricePerHour, commissionRatePercent) : null;
  const total = (visiblePricePerHour ?? 0) * durationHours;
  const canBook = effectiveStartMs !== null && effectiveEndMs !== null;

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
    // When the label and the price don't fit side by side (large text), the price drops whole to
    // the next line instead of both wrapping word by word.
    rateHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 8, rowGap: 2 },
    rateLabel: { flexShrink: 0, fontSize: sc(14), fontWeight: '600', color: colors.text },
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
    monthButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
      paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.teal,
      backgroundColor: colors.surface,
    },
    monthButtonText: { flex: 1, fontSize: sc(14), fontWeight: '600', color: colors.teal },
    rangeRow: { flexDirection: 'row', gap: 10 },
    rangeDate: { flex: 1.55 },
    rangeTime: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
    rangeTimeText: { fontSize: sc(15), color: colors.text, fontVariant: ['tabular-nums'] },
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

    // Same as the payment screen's: the screen's own background instead of a white panel, and it runs to the
    // bottom edge (the home indicator sits over its padding). The content scrolls under it, so a soft shadow
    // upwards -- not a divider line -- is what sets it apart.
    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingHorizontal: 22, paddingTop: sc(12), paddingBottom: insets.bottom + sc(10),
      backgroundColor: colors.background,
      shadowColor: '#042347', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -6 }, elevation: 12,
    },
    footerInfo: { flex: 1 },
    footerTotal: { fontSize: sc(18), fontWeight: '700', color: colors.teal },
    footerWhen: { fontSize: sc(13), color: colors.textSecondary, marginTop: 1 },
    footerButton: {
      minWidth: 130, borderRadius: 14, paddingVertical: sc(14),
      shadowColor: colors.teal, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    editBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.teal, borderRadius: 14, paddingVertical: sc(14),
      shadowColor: colors.teal, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
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
    <Screen style={styles.screen} edges={['left', 'right']}>
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
              {/* Owed for staying past a booking's end: it rides on this reservation, so say so now. */}
              {pendingBalance > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <PendingBalanceBanner pending={pendingBalance} />
                </View>
              )}

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

                  {/* Cuándo hay lugar ese día: arriba de los campos, es lo primero que conviene mirar */}
                  <View style={styles.field}>
                    {availabilityLoading && windows === null ? (
                      <ActivityIndicator size="small" color={colors.teal} style={{ alignSelf: 'flex-start' }} />
                    ) : availabilityError && windows === null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.warn}>{t('spot.availabilityError')}</Text>
                        <TouchableOpacity onPress={refreshAvailability}>
                          <Text style={styles.retry}>{t('spot.availabilityRetry')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : startRanges.length === 0 ? (
                      <Text style={styles.warn}>{t('spot.noSlotsDay')}</Text>
                    ) : (
                      <DayAvailabilityBar
                        domain={barWindow}
                        free={freeInBar}
                        selection={
                          effectiveStartMs !== null && effectiveEndMs !== null
                            ? { startMs: effectiveStartMs, endMs: effectiveEndMs }
                            : null
                        }
                        onPick={handleBarPick}
                      />
                    )}
                    {windows !== null && (
                      <Pressable style={styles.monthButton} onPress={() => setMonthSheetOpen(true)}>
                        <Ionicons name="calendar-outline" size={sc(18)} color={colors.teal} />
                        <Text style={styles.monthButtonText}>{t('spot.month.button')}</Text>
                        <Ionicons name="chevron-forward" size={sc(18)} color={colors.teal} />
                      </Pressable>
                    )}
                  </View>

                  {/* Inicio: día (calendario coloreado por disponibilidad real) + hora */}
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('spot.field.from')}</Text>
                    <View style={styles.rangeRow}>
                      <AvailabilityDatePickerField
                        fetchAvailability={hourlyAvailabilityFetcher(spot.id)}
                        value={selectedDateISO}
                        onChange={handleStartDateChange}
                        placeholder={t('spot.datePlaceholder')}
                        minimumDate={new Date(`${todayArtDateISO()}T00:00:00`)}
                        style={[styles.dateInput, styles.rangeDate]}
                      />
                      <Pressable
                        style={[styles.dateInput, styles.rangeTime]}
                        onPress={() => startRanges.length > 0 && setTimeSheet('start')}
                      >
                        <Text style={styles.rangeTimeText}>{effectiveStartMs !== null ? formatArtTime(effectiveStartMs) : '--:--'}</Text>
                        <Ionicons name="time-outline" size={sc(18)} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Fin: puede ser el mismo día, el siguiente (cruzando la medianoche) o varios después */}
                  {effectiveStartMs !== null && effectiveEndMs !== null && (
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>{t('spot.field.to')}</Text>
                      <View style={styles.rangeRow}>
                        <AvailabilityDatePickerField
                          fetchAvailability={hourlyAvailabilityFetcher(spot.id)}
                          value={endDateISO}
                          onChange={handleEndDateChange}
                          placeholder={t('spot.datePlaceholder')}
                          minimumDate={new Date(`${selectedDateISO}T00:00:00`)}
                          style={[styles.dateInput, styles.rangeDate]}
                        />
                        <Pressable style={[styles.dateInput, styles.rangeTime]} onPress={() => setTimeSheet('end')}>
                          <Text style={styles.rangeTimeText}>{formatArtTime(effectiveEndMs, true)}</Text>
                          <Ionicons name="time-outline" size={sc(18)} color={colors.textSecondary} />
                        </Pressable>
                      </View>
                      {endDateNotice && <Text style={[styles.warn, { marginTop: 8 }]}>{t('spot.endDateUnavailable')}</Text>}
                    </View>
                  )}

                  {canBook && visiblePricePerHour !== null && (
                    <View style={styles.priceLine}>
                      <Text style={styles.priceLineText}>
                        {t('spot.priceLine', { price: formatPesos(visiblePricePerHour), hours: formatHours(durationHours) })}
                      </Text>
                      <Text style={styles.priceLineText}>{formatPesos(total)}</Text>
                    </View>
                  )}

                  {canBook && spot.stayEnabled && durationHours >= 24 && (
                    <Text style={styles.hint}>{t('spot.longRangeHint')}</Text>
                  )}

                  <MonthAvailabilitySheet
                    visible={monthSheetOpen}
                    spotId={spot.id}
                    nowMs={nowMs}
                    selectedMs={effectiveStartMs}
                    onPick={pickStartAt}
                    onClose={() => setMonthSheetOpen(false)}
                  />
                  <TimeEntrySheet
                    visible={timeSheet === 'start'}
                    title={t('spot.sheet.startTitle')}
                    hint={t('spot.time.freeOnDay', { ranges: formatRanges(freeToday, { ms: nowMs, label: t('spot.time.now') }) })}
                    initialDigits={effectiveStartMs !== null ? timeToDigits(effectiveStartMs) : ''}
                    resolve={resolveStartTyped}
                    onConfirm={handleStartTimeConfirm}
                    onClose={() => setTimeSheet(null)}
                  />
                  <TimeEntrySheet
                    visible={timeSheet === 'end'}
                    title={t('spot.sheet.endTitle')}
                    hint={
                      endLimits
                        ? t('spot.time.freeUntil', {
                            until: `${formatDayMonth(endDateOf(endLimits.endMs))} ${formatArtTime(endLimits.endMs, true)}`,
                          })
                        : ''
                    }
                    initialDigits={effectiveEndMs !== null ? timeToDigits(effectiveEndMs, true) : ''}
                    resolve={resolveEndTyped}
                    onConfirm={handleEndTimeConfirm}
                    onClose={() => setTimeSheet(null)}
                  />
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

          {!isOwner && !!user && (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <ReportButton targetType="spot" targetId={spot.id} />
            </View>
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
        ) : spot.status !== 'active' ? (
          // Paused (or otherwise not listed) -- reached from an old booking or a favorite: it
          // can be looked at, not booked.
          <View style={[styles.footerInfo, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: sc(6) }]}>
            <Ionicons name="pause-circle-outline" size={sc(22)} color={colors.warning} />
            <Text style={[styles.footerWhen, { flex: 1, fontSize: sc(14), color: colors.text }]}>{t('spot.notBookable')}</Text>
          </View>
        ) : showHourly ? (
          <>
            <View style={styles.footerInfo}>
              <Text style={styles.footerTotal}>{canBook ? formatPesos(total) : '—'}</Text>
              {canBook && (
                <>
                  <Text style={styles.footerWhen} numberOfLines={1} adjustsFontSizeToFit>
                    {t('spot.footer.from', {
                      when: `${formatWeekdayDayMonth(selectedDateISO)} ${formatArtTime(effectiveStartMs!)}`,
                    })}
                  </Text>
                  <Text style={styles.footerWhen} numberOfLines={1} adjustsFontSizeToFit>
                    {t('spot.footer.to', {
                      when: `${formatWeekdayDayMonth(endDateISO)} ${formatArtTime(effectiveEndMs!, true)}`,
                    })}
                  </Text>
                </>
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
                    startAt: toArtISO(effectiveStartMs!),
                    endAt: toArtISO(effectiveEndMs!),
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
