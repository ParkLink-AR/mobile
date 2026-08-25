import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
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
import { getAvailability, FreeWindow } from '@/src/api/parking';
import { ParkingSpot, ScheduleEntry } from '@/src/types';

// dayOfWeek: 0=Monday…6=Sunday (app convention)
// JS Date.getDay(): 0=Sunday…6=Saturday  → convert: (jsDay + 6) % 7
function appDayOfWeek(): number {
  return (new Date().getDay() + 6) % 7;
}

function todayDateISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addOneDay(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/** Extracts the local hour-of-day from an ISO datetime like "2026-08-24T08:00:00-03:00". */
function hourFromISO(iso: string): number {
  return parseInt(iso.slice(11, 13), 10);
}

/**
 * Returns valid start hours for today from parking-service's real availability
 * (published schedule minus active bookings) -- a start hour `h` is valid if a
 * free window covers [h, h+durationHours].
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
function startHoursFromSchedule(schedule: ScheduleEntry[], durationHours: number): number[] {
  const today = appDayOfWeek();
  const todayEntries = schedule.filter((e) => e.dayOfWeek === today);
  const hours: number[] = [];
  for (const entry of todayEntries) {
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
  const [todayFreeWindows, setTodayFreeWindows] = useState<FreeWindow[] | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  // Real availability (published schedule minus active bookings) for today
  // only -- there's no date picker anywhere in the app yet, everything
  // assumes "today". Falls back to null on failure (e.g. booking-service
  // down) so the picker still shows something, via the schedule-only path.
  useEffect(() => {
    const today = todayDateISO();
    getAvailability(id, today, addOneDay(today))
      .then((res) => setTodayFreeWindows(res.days[0]?.free_windows ?? []))
      .catch(() => setTodayFreeWindows(null));
  }, [id]);

  // Recompute available slots whenever spot, duration, or availability changes
  const availableHours = useMemo(() => {
    if (!spot) return [];
    if (todayFreeWindows) return startHoursFromFreeWindows(todayFreeWindows, durationHours);
    return startHoursFromSchedule(spot.schedule, durationHours);
  }, [spot, todayFreeWindows, durationHours]);

  // Reset selection if it becomes invalid after duration change
  useEffect(() => {
    if (selectedStartHour !== null && !availableHours.includes(selectedStartHour)) {
      setSelectedStartHour(null);
    }
    // Auto-select first available hour if none selected
    if (selectedStartHour === null && availableHours.length > 0) {
      setSelectedStartHour(availableHours[0]);
    }
  }, [availableHours]);

  if (!spot) return null;

  const isOwner = !!user && spot.ownerId === user.id;
  const visiblePricePerHour = getDriverVisiblePrice(spot.pricePerHour);
  const total = visiblePricePerHour * durationHours;
  const canBook = selectedStartHour !== null;

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
    // Slot picker
    slotLabel: { ...typography.caption, marginTop: 10, marginBottom: 4 },
    slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotChip: {
      paddingVertical: 8, paddingHorizontal: 14,
      borderRadius: 20, borderWidth: 1,
      borderColor: colors.teal,
      backgroundColor: colors.surface,
    },
    slotChipSelected: {
      backgroundColor: colors.teal,
    },
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
              onPress={() => router.push(`/(owner)/spots/${spot.id}/edit`)}
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

            {/* Start time slot picker */}
            <View>
              <Text style={styles.slotLabel}>{t('spot.selectStartTime')}</Text>
              {availableHours.length === 0 ? (
                <Text style={styles.noSlotsText}>{t('spot.noSlotsToday')}</Text>
              ) : (
                <View style={styles.slotRow}>
                  {availableHours.map((h) => {
                    const isSelected = h === selectedStartHour;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                        onPress={() => setSelectedStartHour(h)}
                      >
                        <Text style={[styles.slotChipText, isSelected && styles.slotChipTextSelected]}>
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
                    startHour: String(selectedStartHour),
                    endHour: String((selectedStartHour ?? 0) + durationHours),
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
