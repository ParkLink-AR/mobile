import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, StyleProp, ViewStyle, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { getAvailability, getStayAvailability } from '@/src/api/parking';
import { todayArtDateISO } from '@/src/services/dateUtils';
import { t } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';
import { formatShortDate } from '@/src/services/bookingDates';

const UNAVAILABLE_RED = '#C62828';
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // 0=Lunes … 6=Domingo, igual que el resto de la app

function toISO(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m, d));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return toISO(y, m - 1, d + days);
}

// GET .../availability rechaza (400) cualquier rango de más de 14 días
// (AvailabilityService.MAX_RANGE_DAYS en parking-service) -- un mes entero
// puede llegar a 31, así que hay que pedirlo en tramos de a lo sumo 14 y
// mezclar los resultados. Sin esto, el pedido del mes fallaba siempre con
// 400 y el catch genérico lo mostraba como "sin conexión".
const MAX_HOURLY_RANGE_DAYS = 14;

/**
 * Adaptador de disponibilidad para el picker de fecha del alquiler por
 * hora -- "closed" (el dueño no publicó horario ese día) y "full" (ya está
 * reservado a capacidad) se pintan igual (rojo), así que acá se colapsan a
 * un booleano simple, que es todo lo que AvailabilityDatePickerField
 * necesita saber.
 */
export function hourlyAvailabilityFetcher(parkingSpotId: string) {
  return async (from: string, to: string): Promise<Record<string, boolean>> => {
    const chunks: Array<[string, string]> = [];
    let cursor = from;
    while (cursor < to) {
      const chunkEnd = addDaysISO(cursor, MAX_HOURLY_RANGE_DAYS);
      chunks.push([cursor, chunkEnd < to ? chunkEnd : to]);
      cursor = chunkEnd < to ? chunkEnd : to;
    }
    const results = await Promise.all(chunks.map(([f, t]) => getAvailability(parkingSpotId, f, t)));
    const byDate: Record<string, boolean> = {};
    for (const day of results.flatMap((r) => r.days)) byDate[day.date] = day.status === 'available';
    return byDate;
  };
}

/**
 * Adaptador de disponibilidad para el picker de fecha de inicio/fin de
 * estadía -- a diferencia del de arriba, acá "disponible" es una guía día
 * por día (¿tiene ESE día alguna reserva encima?), no una garantía para el
 * rango completo que el conductor termine eligiendo -- ver el comentario en
 * StaysService.getAvailabilityCalendar. GET .../stays/availability ya trae
 * todo el rango pedido en un solo pedido (no hace falta trocear como el de
 * arriba).
 */
export function stayAvailabilityFetcher(parkingSpotId: string) {
  return async (from: string, to: string): Promise<Record<string, boolean>> => {
    const res = await getStayAvailability(parkingSpotId, from, to);
    const byDate: Record<string, boolean> = {};
    for (const day of res.days) byDate[day.date] = day.status === 'available';
    return byDate;
  };
}

function appDayOfWeek(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
}

interface DayCell {
  dateISO: string;
  day: number;
  inMonth: boolean;
}

/** Grilla del mes, alineada a semanas de lunes a domingo -- mismo criterio que app/(owner)/(tabs)/calendar.tsx. */
function buildMonthGrid(year: number, month: number): DayCell[] {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = appDayOfWeek(year, month, 1);

  const cells: DayCell[] = [];
  for (let i = leadingBlanks; i > 0; i--) {
    const d = new Date(Date.UTC(year, month, 1 - i));
    cells.push({ dateISO: toISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), day: d.getUTCDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateISO: toISO(year, month, day), day, inMonth: true });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(Date.UTC(year, month + 1, trailing));
    cells.push({ dateISO: toISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), day: d.getUTCDate(), inMonth: false });
    trailing++;
  }
  return cells;
}

function formatDisplay(iso: string): string {
  return formatShortDate(iso);
}

interface AvailabilityDatePickerFieldProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder: string;
  minimumDate?: Date;
  /** The last day that can be picked (bookings go up to a year ahead). */
  maximumDate?: Date;
  /** Mismo criterio que DatePickerField: caja idéntica a los TextInput vecinos. */
  style?: StyleProp<ViewStyle>;
  /** Devuelve, para el rango [from, to) del mes visible, qué días son
   * seleccionables -- hourlyAvailabilityFetcher/stayAvailabilityFetcher de
   * este mismo archivo arman esta función según el modo de reserva; el
   * calendario en sí no sabe (ni le importa) qué significa "disponible"
   * para cada uno. */
  fetchAvailability: (from: string, to: string) => Promise<Record<string, boolean>>;
}

/**
 * Selector de fecha con el mes pintado en verde (disponible) o rojo (no
 * disponible) -- a diferencia de DatePickerField (que delega en el picker
 * nativo/del navegador, sin forma de pintar días), este dibuja el mes a
 * mano. Sirve tanto para elegir el día de una reserva por hora como el de
 * inicio de una estadía -- cada uno le pasa su propio fetchAvailability.
 */
export function AvailabilityDatePickerField({
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  style,
  fetchAvailability,
}: AvailabilityDatePickerFieldProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [modalVisible, setModalVisible] = useState(false);

  const today = todayArtDateISO();
  const initial = value || today;
  const [initialY, initialM] = initial.split('-').map(Number);
  const [visibleYear, setVisibleYear] = useState(initialY);
  const [visibleMonth, setVisibleMonth] = useState(initialM - 1); // 0-indexado

  const [availableByDate, setAvailableByDate] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const minimumDateISO = minimumDate
    ? `${minimumDate.getFullYear()}-${String(minimumDate.getMonth() + 1).padStart(2, '0')}-${String(minimumDate.getDate()).padStart(2, '0')}`
    : today;
  const maximumDateISO = maximumDate
    ? `${maximumDate.getFullYear()}-${String(maximumDate.getMonth() + 1).padStart(2, '0')}-${String(maximumDate.getDate()).padStart(2, '0')}`
    : '9999-12-31';

  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const from = toISO(visibleYear, visibleMonth, 1);
    const nextMonth = new Date(Date.UTC(visibleYear, visibleMonth + 1, 1));
    const to = toISO(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), nextMonth.getUTCDate());
    fetchAvailability(from, to)
      .then((byDate) => {
        if (cancelled) return;
        setAvailableByDate(byDate);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAvailability is a
    // fresh closure every render from the caller; only the visible month should retrigger this.
  }, [modalVisible, visibleYear, visibleMonth]);

  function openModal() {
    const [y, m] = (value || today).split('-').map(Number);
    setVisibleYear(y);
    setVisibleMonth(m - 1);
    // Close any open keyboard first, or it stays on top of the calendar.
    Keyboard.dismiss();
    setModalVisible(true);
  }

  function goToMonth(delta: number) {
    const d = new Date(Date.UTC(visibleYear, visibleMonth + delta, 1));
    setVisibleYear(d.getUTCFullYear());
    setVisibleMonth(d.getUTCMonth());
  }

  function selectDay(cell: DayCell) {
    if (!cell.inMonth) return;
    if (cell.dateISO < minimumDateISO || cell.dateISO > maximumDateISO) return;
    if (!availableByDate[cell.dateISO]) return;
    onChange(cell.dateISO);
    setModalVisible(false);
  }

  const grid = buildMonthGrid(visibleYear, visibleMonth);
  // Semanas como filas explícitas de 7, en vez de flexWrap con celdas al
  // 100/7% -- ese porcentaje no es exacto (14.2857...%) y el redondeo
  // acumulado de 7 celdas empuja la última (domingo) a la fila siguiente,
  // corriendo todas las fechas una columna. Con flex:1 dentro de una fila
  // fija (mismo criterio que ya usa weekRow para Lun..Dom, que nunca tuvo
  // este problema) no hay redondeo de por medio.
  const weeks: DayCell[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    weeks.push(grid.slice(i, i + 7));
  }
  // timeZone: 'UTC' es necesario -- sin esto, toLocaleDateString convierte la
  // medianoche UTC del día 1 a la hora local (ej. Argentina, UTC-3), que cae
  // en el día anterior y muestra el mes equivocado en el título, aunque la
  // grilla de abajo (que usa getUTCFullYear/getUTCMonth) esté bien.
  const monthLabel = new Date(Date.UTC(visibleYear, visibleMonth, 1)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).replace(/^./, (first) => first.toUpperCase()); // "Octubre de 2026" -- not "Octubre De 2026"

  const styles = StyleSheet.create({
    box: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    },
    text: { fontSize: sc(15), color: value ? colors.text : colors.textSecondary },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.45)', justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    sheet: {
      width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navBtn: { padding: 6 },
    monthLabel: { fontSize: sc(16), fontWeight: '700', color: colors.text },
    closeBtn: { padding: 4 },
    weekRow: { flexDirection: 'row' },
    weekDayCell: { flex: 1, alignItems: 'center', paddingBottom: 4 },
    weekDayText: { fontSize: sc(11), fontWeight: '700', color: colors.textSecondary },
    grid: { gap: 2 },
    weekRowGrid: { flexDirection: 'row' },
    dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    dayCircle: {
      width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    },
    dayCircleAvailable: { borderColor: colors.success },
    dayCircleUnavailable: { borderColor: UNAVAILABLE_RED },
    dayCircleDisabled: { borderColor: 'transparent' },
    dayCircleSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
    dayText: { fontSize: sc(14), color: colors.text },
    dayTextAvailable: { color: colors.success, fontWeight: '600' },
    dayTextUnavailable: { color: UNAVAILABLE_RED },
    dayTextDisabled: { color: colors.textSecondary, opacity: 0.35 },
    dayTextSelected: { color: colors.white, fontWeight: '700' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: sc(12), color: colors.textSecondary },
    errorText: { fontSize: sc(13), color: UNAVAILABLE_RED, textAlign: 'center' },
  });

  return (
    <>
      <View style={[style, styles.box]}>
        <Pressable style={{ flex: 1 }} onPress={openModal}>
          <Text style={styles.text}>{value ? formatDisplay(value) : placeholder}</Text>
        </Pressable>
        <Ionicons name="calendar-outline" size={sc(18)} color={colors.textSecondary} />
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.monthNav}>
                <Pressable style={styles.navBtn} onPress={() => goToMonth(-1)} hitSlop={8}>
                  <Ionicons name="chevron-back" size={sc(20)} color={colors.text} />
                </Pressable>
                <Text style={styles.monthLabel}>{monthLabel}</Text>
                <Pressable style={styles.navBtn} onPress={() => goToMonth(1)} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={sc(20)} color={colors.text} />
                </Pressable>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={sc(22)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {DAY_SHORT.map((d) => (
                <View key={d} style={styles.weekDayCell}>
                  <Text style={styles.weekDayText}>{d}</Text>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={colors.teal} style={{ marginVertical: 24 }} />
            ) : loadError ? (
              <Text style={styles.errorText}>{t('spot.availabilityError')}</Text>
            ) : (
              <View style={styles.grid}>
                {weeks.map((week, weekIndex) => (
                  <View key={weekIndex} style={styles.weekRowGrid}>
                    {week.map((cell) => {
                      // Out of the pickable range: before the first day, or past the last one.
                      const isPast = cell.dateISO < minimumDateISO || cell.dateISO > maximumDateISO;
                      const isSelected = cell.dateISO === value;
                      const isAvailable = cell.inMonth && !isPast && availableByDate[cell.dateISO] === true;
                      const isUnavailable = cell.inMonth && !isPast && availableByDate[cell.dateISO] === false;
                      return (
                        <Pressable key={cell.dateISO} style={styles.dayCell} onPress={() => selectDay(cell)}>
                          <View
                            style={[
                              styles.dayCircle,
                              isAvailable && styles.dayCircleAvailable,
                              isUnavailable && styles.dayCircleUnavailable,
                              (!cell.inMonth || isPast) && styles.dayCircleDisabled,
                              isSelected && styles.dayCircleSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                isAvailable && styles.dayTextAvailable,
                                isUnavailable && styles.dayTextUnavailable,
                                (!cell.inMonth || isPast) && styles.dayTextDisabled,
                                isSelected && styles.dayTextSelected,
                              ]}
                            >
                              {cell.day}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>{t('spot.calendar.available')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: UNAVAILABLE_RED }]} />
                <Text style={styles.legendText}>{t('spot.calendar.unavailable')}</Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
