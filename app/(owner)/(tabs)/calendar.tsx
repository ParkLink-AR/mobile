import { t, useLanguage } from '@/src/i18n';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getOwnerBookings } from '@/src/services/ownerBookings';
import { getPublicProfileApi } from '@/src/api/auth';
import { todayArtDateISO } from '@/src/services/dateUtils';
import { Booking } from '@/src/types';

// Mismo criterio que spot/[id].tsx: 0=Lunes … 6=Domingo.
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toISO(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m, d));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function appDayOfWeek(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
}

interface DayCell {
  dateISO: string;
  day: number;
  inMonth: boolean;
}

/** Grilla del mes, alineada a semanas de lunes a domingo, con relleno de los meses vecinos. */
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

export default function OwnerCalendar() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const today = todayArtDateISO();
  const [todayYearStr, todayMonthStr] = today.split('-');
  const year = Number(todayYearStr);
  const month = Number(todayMonthStr) - 1; // 0-indexado, como Date.UTC

  const [visibleYear, setVisibleYear] = useState(year);
  const [visibleMonth, setVisibleMonth] = useState(month); // 0-indexado
  const [selectedDate, setSelectedDate] = useState(today);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getOwnerBookings(user.id)
      .then((all) => {
        setBookings(all);
        const driverIds = [...new Set(all.map((b) => b.driverId))];
        Promise.allSettled(
          driverIds.map((driverId) =>
            getPublicProfileApi(driverId).then((profile) => {
              setDriverNames((prev) => ({ ...prev, [driverId]: profile.name }));
            }),
          ),
        );
      })
      .catch((err) => console.warn('[OwnerCalendar] fetch error:', err))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useFocusEffect(load);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) {
      (map[b.date] ??= []).push(b);
    }
    return map;
  }, [bookings]);

  const grid = useMemo(() => buildMonthGrid(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  // Semanas como filas explícitas de 7 -- ver el comentario en
  // AvailabilityDatePickerField.tsx: celdas al 100/7% con flexWrap corren
  // la última columna (domingo) a la fila siguiente por redondeo.
  const weeks = useMemo(() => {
    const result: typeof grid[] = [];
    for (let i = 0; i < grid.length; i += 7) result.push(grid.slice(i, i + 7));
    return result;
  }, [grid]);
  // timeZone: 'UTC' es necesario -- sin esto, toLocaleDateString convierte la
  // medianoche UTC del día 1 a la hora local (ej. Argentina, UTC-3), que cae
  // en el día anterior y muestra el mes equivocado en el título, aunque la
  // grilla de abajo (que usa getUTCFullYear/getUTCMonth) esté bien.
  const monthLabel = new Date(Date.UTC(visibleYear, visibleMonth, 1)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const selectedDayBookings = bookingsByDate[selectedDate] ?? [];

  function goToMonth(delta: number) {
    const d = new Date(Date.UTC(visibleYear, visibleMonth + delta, 1));
    setVisibleYear(d.getUTCFullYear());
    setVisibleMonth(d.getUTCMonth());
  }

  function goToToday() {
    setVisibleYear(year);
    setVisibleMonth(month);
    setSelectedDate(today);
  }

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 120, gap: 16 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthLabel: { fontSize: 17, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
    navBtn: { padding: 6 },
    todayLink: { alignSelf: 'center' },
    todayLinkText: { fontSize: 13, fontWeight: '600', color: colors.teal },
    weekRow: { flexDirection: 'row' },
    weekDayCell: { flex: 1, alignItems: 'center', paddingBottom: 6 },
    weekDayText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    grid: { gap: 2 },
    weekRowGrid: { flexDirection: 'row' },
    dayCell: {
      flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3,
    },
    dayCircle: {
      width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    },
    dayCircleSelected: { backgroundColor: colors.teal },
    dayCircleToday: { borderWidth: 1.5, borderColor: colors.teal },
    dayText: { fontSize: 14, color: colors.text },
    dayTextOutOfMonth: { color: colors.textSecondary, opacity: 0.4 },
    dayTextSelected: { color: colors.white, fontWeight: '700' },
    dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.teal },
    dotHidden: { opacity: 0 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: {
      fontSize: 13, fontWeight: '700', color: colors.text,
      textTransform: 'capitalize',
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
    emptyCard: {
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      padding: 24, alignItems: 'center', gap: 8,
    },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    bookingCard: { gap: 6 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    driverRowText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    spotTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });

  const selectedDateLabel = new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <FlatList
        data={selectedDayBookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Text style={typography.h1}>{t('tabs.owner.calendar')}</Text>

            <View style={styles.monthNav}>
              <Pressable style={styles.navBtn} onPress={() => goToMonth(-1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable style={styles.navBtn} onPress={() => goToMonth(1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {DAY_SHORT.map((d) => (
                <View key={d} style={styles.weekDayCell}>
                  <Text style={styles.weekDayText}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekRowGrid}>
                  {week.map((cell) => {
                    const isSelected = cell.dateISO === selectedDate;
                    const isToday = cell.dateISO === today;
                    const hasBookings = (bookingsByDate[cell.dateISO]?.length ?? 0) > 0;
                    return (
                      <Pressable
                        key={cell.dateISO}
                        style={styles.dayCell}
                        onPress={() => setSelectedDate(cell.dateISO)}
                      >
                        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected, !isSelected && isToday && styles.dayCircleToday]}>
                          <Text style={[styles.dayText, !cell.inMonth && styles.dayTextOutOfMonth, isSelected && styles.dayTextSelected]}>
                            {cell.day}
                          </Text>
                        </View>
                        <View style={[styles.dot, !hasBookings && styles.dotHidden]} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Pressable style={styles.todayLink} onPress={goToToday}>
              <Text style={styles.todayLinkText}>{t('owner.calendar.goToToday')}</Text>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{selectedDateLabel}</Text>
              <View style={styles.sectionLine} />
            </View>

            {loading && bookings.length === 0 && (
              <ActivityIndicator color={colors.teal} style={{ marginTop: 8 }} />
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{t('owner.calendar.emptyDay')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.bookingCard}>
            <Text style={styles.spotTitle}>{item.parkingSpotTitle}</Text>
            <View style={styles.driverRow}>
              <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.driverRowText}>{driverNames[item.driverId] ?? item.driverId}</Text>
            </View>
            <View style={styles.timeRow}>
              <Text style={typography.body}>
                {item.startTime} {t('driver.booking.timeTo')} {item.endTime}
              </Text>
              <StatusBadge status={item.status} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
