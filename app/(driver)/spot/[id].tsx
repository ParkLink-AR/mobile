import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { TAG_LABEL_KEYS } from '@/src/components/ParkingSpotCard';
import { RatingStars } from '@/src/components/RatingStars';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail, formatScheduleForDisplay } from '@/src/services/parkingService';
import { useAvailability } from '@/src/hooks/useAvailability';
import type { FreeWindow } from '@/src/api/parking';
import { ParkingSpot, ScheduleEntry } from '@/src/types';

// ── Day helpers ───────────────────────────────────────────────────────────────

// App day-of-week convention: 0=Monday … 6=Sunday
// JS Date.getDay():            0=Sunday … 6=Saturday → convert: (jsDay + 6) % 7
function toAppDayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Returns an array of { date, label } for today + the next 6 days (7 total). */
function getNextSevenDays(): Array<{ date: Date; label: string; shortLabel: string; dateISO: string }> {
  const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const appDay = toAppDayOfWeek(d);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      date: d,
      shortLabel: DAY_SHORT[appDay],
      label: `${day}/${month}`,
      dateISO: `${year}-${month}-${day}`,
    };
  });
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
 * free window covers [h, h+durationHours].
 * Includes past hours too — caller marks them as past via isPastHour().
 */
function startHoursFromFreeWindows(freeWindows: FreeWindow[], durationHours: number): number[] {
  const hours: number[] = [];
  for (const window of freeWindows) {
    const start = hourFromISO(window.start);
    const end = hourFromISO(window.end);
    for (let h = start; h + durationHours <= end; h++) {
      hours.push(h);
    }
  }
  return hours.sort((a, b) => a - b);
}

/**
 * Fallback when the availability call fails: valid start hours from the
 * spot's published schedule alone (doesn't exclude existing bookings).
 */
function startHoursFromSchedule(schedule: ScheduleEntry[], durationHours: number, date: Date): number[] {
  const dayOfWeek = toAppDayOfWeek(date);
  const entries = schedule.filter((e) => e.dayOfWeek === dayOfWeek);
  const hours: number[] = [];
  for (const entry of entries) {
    for (let h = entry.startHour; h + durationHours <= entry.endHour; h++) {
      hours.push(h);
    }
  }
  return hours.sort((a, b) => a - b);
}

export default function SpotDetail() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const user = useSessionStore((s) => s.user);

  const days = useMemo(() => getNextSevenDays(), []);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = days[selectedDayIndex];

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  // Auto-refreshing availability: refetches on day/duration change and every 30 s.
  // durationHours is passed so the hook re-runs when the user changes it.
  const { freeWindows, loading: availabilityLoading, refresh: refreshAvailability } =
    useAvailability(id, selectedDay.dateISO, durationHours);

  // Refresh whenever the screen comes back into focus (e.g. after pressing "back"
  // from the confirm screen when there was a 409 conflict).
  useFocusEffect(
    useCallback(() => {
      refreshAvailability();
    }, [refreshAvailability]),
  );

  // Recompute available slots whenever spot, duration, or availability changes.
  // When still loading we return [] so the picker shows a spinner instead of stale slots.
  const allHours = useMemo(() => {
    if (!spot || availabilityLoading) return [];
    if (freeWindows !== null) return startHoursFromFreeWindows(freeWindows, durationHours);
    return startHoursFromSchedule(spot.schedule, durationHours, selectedDay.date);
  }, [spot, freeWindows, availabilityLoading, durationHours, selectedDay]);

  // Cutoff hour for the selected day (with 10-min grace). Hours strictly below
  // this are in the past and cannot be booked.
  const pastCutoffHour = useMemo(
    () => currentArtHourForDate(selectedDay.dateISO),
    [selectedDay.dateISO],
  );

  // Only show hours that are not in the past — past hours are never bookable and
  // displaying them (even greyed-out) confuses the user into thinking they can pick them.
  const bookableHours = useMemo(
    () => allHours.filter((h) => h >= pastCutoffHour),
    [allHours, pastCutoffHour],
  );

  // Derive the effective selected hour: if the current selection is no longer
  // in bookableHours (e.g. day changed, slot was just taken), fall back to the
  // first available hour. This replaces a useEffect+setState pattern with pure
  // derivation so there are no cascading renders.
  const effectiveStartHour: number | null = bookableHours.includes(selectedStartHour as number)
    ? selectedStartHour
    : bookableHours[0] ?? null;

  if (!spot) return null;

  const isOwner = !!user && spot.ownerId === user.id;
  const visiblePricePerHour = getDriverVisiblePrice(spot.pricePerHour);
  const total = visiblePricePerHour * durationHours;
  const canBook = effectiveStartHour !== null;

  const styles = StyleSheet.create({
    screen: { backgroundColor: colors.surface },
    container: { flex: 1, backgroundColor: colors.surface },
    photo: { width: '100%', height: 200 },
    body: { padding: 16, gap: 10 },
    tagRow: { flexDirection: 'row', marginVertical: 4 },
    row: { marginTop: 6 },
    total: { ...typography.h2, color: colors.teal, marginVertical: 10 },
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
    // Duration selector
    durationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    durationBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    },
    durationBtnDisabled: { backgroundColor: colors.teal + '44' },
    durationBtnText: { fontSize: 20, fontWeight: '700', color: colors.white },
    durationValue: { ...typography.h2, minWidth: 40, textAlign: 'center' },
    // Day picker
    dayRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    dayChip: {
      alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, paddingHorizontal: 10,
      borderRadius: 12, borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minWidth: 48,
    },
    dayChipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
    dayChipLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    dayChipDate: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 1 },
    dayChipLabelSelected: { color: colors.white },
    dayChipDateSelected: { color: colors.white },
    // Slot picker
    slotLabel: { ...typography.caption, marginTop: 10, marginBottom: 4 },
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
    noSlotsText: { ...typography.body, color: colors.warning, marginTop: 4 },
  });

  return (
    <Screen style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container}>
      <Image source={{ uri: spot.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <Text style={typography.h1}>{spot.title}</Text>
        <TouchableOpacity onPress={() => router.push(`/(driver)/spot/${spot.id}/reviews`)}>
          <RatingStars rating={spot.rating} count={spot.reviewCount} />
        </TouchableOpacity>
        <View style={styles.tagRow}>
          {spot.tags.map((tag) => (
            <Chip key={tag} label={TAG_LABEL_KEYS[tag] ? t(TAG_LABEL_KEYS[tag]) : tag} />
          ))}
        </View>
        {(spot.descriptionKey || spot.description) ? (
          <Row
            label={t('spot.description')}
            value={spot.descriptionKey ? t(spot.descriptionKey) : spot.description}
          />
        ) : null}
        <Row label={t('spot.address')} value={spot.address} />
        <ScheduleRow label={t('spot.available')} schedule={spot.schedule} />
        <Row label={t('spot.pricePerHour')} value={t('spot.pricePerHour.withUnit', { price: String(visiblePricePerHour) })} />

        {isOwner ? (
          <>
            <View style={styles.ownerBanner}>
              <Ionicons name="home-outline" size={18} color={colors.teal} />
              <Text style={styles.ownerBannerText}>{t('spot.ownedByYou')}</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(driver)/spots/${spot.id}/edit`)}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.white} />
              <Text style={styles.editBtnText}>{t('spot.editSpot')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Duration selector */}
            <View style={{ marginTop: 6 }}>
              <Text style={typography.caption}>{t('spot.selectHours')}</Text>
              <View style={styles.durationRow}>
                <TouchableOpacity
                  style={[styles.durationBtn, durationHours <= 1 && styles.durationBtnDisabled]}
                  onPress={() => setDurationHours((h) => Math.max(1, h - 1))}
                  disabled={durationHours <= 1}
                >
                  <Text style={styles.durationBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.durationValue}>{durationHours}</Text>
                <TouchableOpacity
                  style={[styles.durationBtn, durationHours >= 12 && styles.durationBtnDisabled]}
                  onPress={() => setDurationHours((h) => Math.min(12, h + 1))}
                  disabled={durationHours >= 12}
                >
                  <Text style={styles.durationBtnText}>+</Text>
                </TouchableOpacity>
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  {t('driver.booking.hoursUnit')}
                </Text>
              </View>
            </View>

            {/* Day picker */}
            <View>
              <Text style={styles.slotLabel}>{t('spot.selectDay')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.dayRow}>
                  {days.map((day, idx) => {
                    const isSelected = idx === selectedDayIndex;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                        onPress={() => setSelectedDayIndex(idx)}
                      >
                        <Text style={[styles.dayChipLabel, isSelected && styles.dayChipLabelSelected]}>
                          {day.shortLabel}
                        </Text>
                        <Text style={[styles.dayChipDate, isSelected && styles.dayChipDateSelected]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Start time slot picker */}
            <View>
              <Text style={styles.slotLabel}>{t('spot.selectStartTime')}</Text>
              {availabilityLoading ? (
                <ActivityIndicator size="small" color={colors.teal} style={{ marginTop: 8 }} />
              ) : bookableHours.length === 0 ? (
                <Text style={styles.noSlotsText}>{t('spot.noSlotsToday')}</Text>
              ) : (
                <View style={styles.slotRow}>
                  {bookableHours.map((h) => {
                    const isSelected = h === effectiveStartHour;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                        onPress={() => setSelectedStartHour(h)}
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

            <Text style={styles.total}>{t('spot.total', { hours: String(durationHours), total: String(total) })}</Text>
            <Button
              title={t('spot.bookNow')}
              onPress={() =>
                router.push({
                  pathname: '/(driver)/booking/confirm',
                  params: {
                    spotId: spot.id,
                    hours: String(durationHours),
                    startHour: String(effectiveStartHour),
                    endHour: String((effectiveStartHour ?? 0) + durationHours),
                    bookingDate: selectedDay.dateISO,
                  },
                })
              }
              disabled={!canBook}
            />
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
