import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { getAvailability, type DayAvailability } from '@/src/api/parking';
import { addDaysISO, artMidnightForDate, todayArtDateISO } from '@/src/services/dateUtils';
import { formatMonthYear, formatWeekdayShortDay } from '@/src/services/bookingDates';
import {
  barTicks,
  formatArtTime,
  freeRangesIn,
  mergeFreeWindows,
  pickStartFromTap,
  validStartRanges,
} from '@/src/services/bookingRange';
import { AvailabilityBar } from '@/src/components/AvailabilityBar';

const MAX_RANGE_DAYS = 14; // tope de GET /availability en parking-service
const LABEL_WIDTH = 64;
const ROW_GAP = 10;

interface MonthAvailabilitySheetProps {
  visible: boolean;
  spotId: string;
  nowMs: number;
  /** El inicio ya elegido (para marcarlo), si hay uno. */
  selectedMs: number | null;
  /** El conductor eligió este inicio (ya validado contra lo libre). */
  onPick: (ms: number) => void;
  onClose: () => void;
}

interface Month {
  year: number;
  month: number; // 1-12
}

const pad = (n: number) => String(n).padStart(2, '0');
const firstOf = ({ year, month }: Month) => `${year}-${pad(month)}-01`;
const nextMonth = ({ year, month }: Month): Month => (month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 });
const prevMonth = ({ year, month }: Month): Month => (month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 });

/**
 * Detalle de la disponibilidad: una fila con su barra por cada día del mes (de hoy en adelante, si es el mes en
 * curso), para ver de un vistazo dónde hay lugar sin ir día por día. Tocar un tramo verde elige ahí el inicio; tocar
 * uno gris dice desde cuándo hasta cuándo no está disponible.
 */
export function MonthAvailabilitySheet(props: MonthAvailabilitySheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      {props.visible && <Sheet {...props} />}
    </Modal>
  );
}

// Se monta recién al abrir, así siempre arranca en el mes en curso, sin elegir y sin datos viejos.
function Sheet({ spotId, nowMs, selectedMs, onPick, onClose }: MonthAvailabilitySheetProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  const today = todayArtDateISO();
  const currentMonth = useMemo<Month>(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }), [today]);
  const [month, setMonth] = useState<Month>(currentMonth);
  const [pending, setPending] = useState<number | null>(selectedMs);

  const isCurrentMonth = month.year === currentMonth.year && month.month === currentMonth.month;
  const fromISO = isCurrentMonth ? today : firstOf(month);
  const toISO = firstOf(nextMonth(month)); // exclusivo
  const key = `${spotId}:${fromISO}:${toISO}`;

  const { days, loading, error, retry } = useRangeAvailability(spotId, fromISO, toISO, key);
  const windows = useMemo(() => mergeFreeWindows(days ?? []), [days]);

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '88%' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
    title: { fontSize: sc(17), fontWeight: '600', color: colors.text },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
    monthText: { fontSize: sc(14), color: colors.textSecondary, minWidth: 110, textAlign: 'center' },
    hint: { fontSize: sc(13), color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8 },
    ticksRow: { flexDirection: 'row', gap: ROW_GAP, paddingHorizontal: 20, paddingBottom: 4 },
    ticks: { flex: 1, height: sc(14) },
    tick: { position: 'absolute', width: 24, alignItems: 'center' },
    tickText: { fontSize: sc(11), color: colors.textSecondary },
    list: { flex: 1, paddingHorizontal: 20 },
    center: { paddingVertical: 40, alignItems: 'center', gap: 8 },
    warn: { fontSize: sc(14), color: colors.warning },
    retry: { fontSize: sc(14), fontWeight: '600', color: colors.teal, textDecorationLine: 'underline' },
    row: { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, paddingVertical: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    dayLabel: { width: LABEL_WIDTH },
    dayText: { fontSize: sc(13), color: colors.text },
    dayTag: { fontSize: sc(11), color: colors.textSecondary },
    rowBar: { flex: 1 },
    status: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    statusText: { fontSize: sc(11), color: colors.textSecondary },
    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface,
    },
    footerText: { flex: 1, fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    footerStrong: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    useButton: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, opacity: pending === null ? 0.45 : 1 },
    useText: { fontSize: sc(14), fontWeight: '600', color: colors.white },
  });

  // Lo libre se cuenta desde ahora (menos la tolerancia de 10 min): lo pasado de hoy queda en gris.
  const fullDayTicks = useMemo(() => {
    const dayStart = artMidnightForDate(today);
    return barTicks({ startMs: dayStart, endMs: dayStart + 24 * 3_600_000 });
  }, [today]);
  const dates = useMemo(() => {
    const result: string[] = [];
    for (let date = fromISO; date < toISO; date = addDaysISO(date, 1)) result.push(date);
    return result;
  }, [fromISO, toISO]);

  function pickOnDay(dateISO: string, tapMs: number) {
    const ms = pickStartFromTap(validStartRanges(windows, dateISO, nowMs), tapMs);
    if (ms !== null) setPending(ms);
  }

  const pendingLabel = pending !== null ? `${formatWeekdayShortDay(dateOfMs(pending))} · ${formatArtTime(pending)}` : null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('spot.month.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={sc(22)} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth(prevMonth(month))} disabled={isCurrentMonth} hitSlop={10} style={{ opacity: isCurrentMonth ? 0.3 : 1 }}>
            <Ionicons name="chevron-back" size={sc(20)} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.monthText}>{formatMonthYear(month.year, month.month)}</Text>
          <Pressable onPress={() => setMonth(nextMonth(month))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={sc(20)} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.hint}>{t('spot.month.hint')}</Text>
        <View style={styles.ticksRow}>
          <View style={{ width: LABEL_WIDTH }} />
          <View style={styles.ticks}>
            {fullDayTicks.map(({ fraction, hour }) => (
              <View
                key={hour}
                style={[
                  styles.tick,
                  { left: `${fraction * 100}%` },
                  fraction === 0 ? { alignItems: 'flex-start' } : fraction === 1 ? { marginLeft: -24, alignItems: 'flex-end' } : { marginLeft: -12 },
                ]}
              >
                <Text style={styles.tickText}>{hour}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.teal} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.warn}>{t('spot.availabilityError')}</Text>
            <Pressable onPress={retry}>
              <Text style={styles.retry}>{t('spot.availabilityRetry')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {dates.map((dateISO, index) => {
              const dayStart = artMidnightForDate(dateISO);
              const domain = { startMs: dayStart, endMs: dayStart + 24 * 3_600_000 };
              const free = freeRangesIn(
                windows.map((window) => ({ ...window, startMs: Math.max(window.startMs, nowMs - 10 * 60_000) })),
                domain,
              );
              const status = days?.find((day) => day.date === dateISO)?.status;
              const empty = free.length === 0;
              const selection =
                pending !== null && dateOfMs(pending) === dateISO ? { startMs: pending, endMs: pending + 60 * 60_000 } : null;
              return (
                <View key={dateISO} style={styles.row}>
                  <View style={styles.dayLabel}>
                    <Text style={styles.dayText}>{formatWeekdayShortDay(dateISO)}</Text>
                    {dateISO === today && <Text style={styles.dayTag}>{t('spot.month.today')}</Text>}
                  </View>
                  <View style={styles.rowBar}>
                    <AvailabilityBar
                      domain={domain}
                      free={free}
                      selection={selection}
                      onPick={(ms) => pickOnDay(dateISO, ms)}
                      barHeight={18}
                      touchHeight={34}
                      tooltipBelow={index < 2}
                    />
                    {empty && (
                      <View style={styles.status} pointerEvents="none">
                        <Text style={styles.statusText}>
                          {status === 'closed' ? t('spot.month.closed') : status === 'full' ? t('spot.month.full') : t('spot.month.none')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {pendingLabel ? (
              <>
                <Text style={styles.footerStrong}>{pendingLabel}</Text>
                {'\n'}
                {t('spot.month.startHere')}
              </>
            ) : (
              t('spot.month.pickPrompt')
            )}
          </Text>
          <Pressable
            style={styles.useButton}
            onPress={() => {
              if (pending !== null) {
                onPick(pending);
                onClose();
              }
            }}
          >
            <Text style={styles.useText}>{t('spot.month.use')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

/** YYYY-MM-DD (Buenos Aires) del instante. */
function dateOfMs(ms: number): string {
  return new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Disponibilidad de [fromISO, toISO) pedida en tramos de a lo sumo 14 días (el tope de parking-service). `key`
 * identifica el pedido: cambia al cambiar de mes, y mientras lo cargado no sea el de esa key se considera "cargando".
 */
function useRangeAvailability(spotId: string, fromISO: string, toISO: string, key: string) {
  const [result, setResult] = useState<{ key: string; days: DayAvailability[] | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const chunks: Array<[string, string]> = [];
    for (let cursor = fromISO; cursor < toISO; ) {
      const end = addDaysISO(cursor, MAX_RANGE_DAYS);
      const chunkEnd = end < toISO ? end : toISO;
      chunks.push([cursor, chunkEnd]);
      cursor = chunkEnd;
    }
    Promise.all(chunks.map(([from, to]) => getAvailability(spotId, from, to)))
      .then((responses) => {
        if (!cancelled) setResult({ key, days: responses.flatMap((response) => response.days) });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, days: null });
      });
    return () => {
      cancelled = true;
    };
  }, [spotId, fromISO, toISO, key, attempt]);

  const current = result?.key === key ? result : null;
  return {
    days: current?.days ?? null,
    loading: current === null,
    error: current !== null && current.days === null,
    retry: () => {
      setResult(null);
      setAttempt((value) => value + 1);
    },
  };
}
