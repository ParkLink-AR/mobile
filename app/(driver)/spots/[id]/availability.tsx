import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { AvailabilityPicker, DaySchedule } from '@/src/components/AvailabilityPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { getParkingSpotDetail, updateParkingSpot, formatScheduleForDisplay } from '@/src/services/parkingService';
import { useSpotsStore } from '@/src/store/useSpotsStore';
import { ParkingSpot, ScheduleEntry } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

function toDaySchedule(schedule: ScheduleEntry[]): DaySchedule[] {
  return schedule.map((entry) => ({
    dayIndex: entry.dayOfWeek,
    startHour: entry.startHour,
    endHour: entry.endHour,
  }));
}

function toScheduleEntries(days: DaySchedule[]): ScheduleEntry[] {
  return days.map((day) => ({ dayOfWeek: day.dayIndex, startHour: day.startHour, endHour: day.endHour }));
}

export default function SpotAvailability() {
  const colors = useThemeColors();
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const markUpdated = useSpotsStore((s) => s.markUpdated);
  const clearSpots = useSpotsStore((s) => s.clearSpots);

  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getParkingSpotDetail(id).then((s) => {
        if (!s) return;
        setSpot(s);
        setSchedule(
          s.schedule.length > 0
            ? toDaySchedule(s.schedule)
            : [0, 1, 2, 3, 4].map((d) => ({ dayIndex: d, startHour: 8, endHour: 22 })),
        );
      });
    }, [id]),
  );

  if (!spot) return null;

  async function saveAvailability() {
    if (schedule.length === 0) {
      alert(t('owner.spot.new.requiredSchedule'));
      return;
    }
    try {
      setSaving(true);
      await updateParkingSpot(id, { schedule: toScheduleEntries(schedule) });
      clearSpots();
      markUpdated();
      router.back();
    } catch {
      alert(t('owner.spot.edit.errorSave'));
      setSaving(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },

    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 6,
    },
    spotTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    currentSchedule: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },

    saveBtn: { marginTop: 4 },
  });

  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.infoCard}>
            <Text style={styles.spotTitle}>{spot.title}</Text>
            {formatScheduleForDisplay(spot.schedule).map((line) => (
              <Text key={line.dayRange} style={styles.currentSchedule}>
                {line.dayRange}: {line.hours}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>{t('owner.spot.edit.availability')}</Text>
            </View>
            <AvailabilityPicker value={schedule} onChange={setSchedule} />
          </View>

          <Button
            title={saving ? t('owner.spot.edit.saving') : t('owner.spot.edit.save')}
            onPress={saveAvailability}
            disabled={saving}
            style={styles.saveBtn}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
