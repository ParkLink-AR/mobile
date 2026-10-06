/**
 * AvailabilityPicker
 *
 * Renders a row of day chips (Lu–Do). Each active day expands to show one or
 * more time-slot rows. Owners can add multiple slots per day (split shifts,
 * e.g. 08:00–12:00 and 16:00–19:00) and remove individual slots.
 *
 * Data model
 * ----------
 * `DayScheduleGroup` — one per active day, holds an array of `TimeSlot`.
 * `TimeSlot`         — a { startHour, endHour } pair.
 *
 * The flat `ScheduleEntry[]` that the backend expects is produced by the
 * caller via `dayGroupsToEntries()` (exported as a helper).
 */
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { t } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

export interface TimeSlot {
  startHour: number;
  endHour: number;
}

export interface DayScheduleGroup {
  /** 0 = Monday … 6 = Sunday */
  dayIndex: number;
  slots: TimeSlot[];
}

/** @deprecated Use DayScheduleGroup instead. Kept for smooth migration. */
export interface DaySchedule {
  dayIndex: number;
  startHour: number;
  endHour: number;
}

interface AvailabilityPickerProps {
  value: DayScheduleGroup[];
  onChange: (next: DayScheduleGroup[]) => void;
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmt(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Returns true if two slots overlap (sharing an edge is NOT an overlap). */
function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

/** Returns true if the given slot overlaps with any other slot in the array. */
function hasConflict(slots: TimeSlot[], slotIndex: number): boolean {
  const target = slots[slotIndex];
  return slots.some((s, i) => i !== slotIndex && slotsOverlap(target, s));
}

export function AvailabilityPicker({ value, onChange }: AvailabilityPickerProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  // ── Day toggle ────────────────────────────────────────────────────────────
  function toggleDay(idx: number) {
    const exists = value.find((d) => d.dayIndex === idx);
    if (exists) {
      onChange(value.filter((d) => d.dayIndex !== idx));
    } else {
      const next = [
        ...value,
        { dayIndex: idx, slots: [{ startHour: 8, endHour: 20 }] },
      ].sort((a, b) => a.dayIndex - b.dayIndex);
      onChange(next);
    }
  }

  // ── Add a slot to a day ───────────────────────────────────────────────────
  function addSlot(dayIndex: number) {
    onChange(
      value.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        // Default new slot starts 1h after the last slot ends, capped at 23:00
        const lastEnd = d.slots.reduce((max, s) => Math.max(max, s.endHour), 0);
        const newStart = Math.min(lastEnd, 22);
        const newEnd = Math.min(newStart + 2, 24);
        return { ...d, slots: [...d.slots, { startHour: newStart, endHour: newEnd }] };
      }),
    );
  }

  // ── Remove a slot ─────────────────────────────────────────────────────────
  function removeSlot(dayIndex: number, slotIndex: number) {
    onChange(
      value.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        const next = d.slots.filter((_, i) => i !== slotIndex);
        return { ...d, slots: next };
      }).filter((d) => d.slots.length > 0), // deactivate day if all slots removed
    );
  }

  // ── Update a single hour field ────────────────────────────────────────────
  function updateHour(
    dayIndex: number,
    slotIndex: number,
    field: 'startHour' | 'endHour',
    delta: number,
  ) {
    onChange(
      value.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        const slots = d.slots.map((s, i) => {
          if (i !== slotIndex) return s;
          if (field === 'startHour') {
            return { ...s, startHour: clamp(s.startHour + delta, 0, s.endHour - 1) };
          } else {
            return { ...s, endHour: clamp(s.endHour + delta, s.startHour + 1, 24) };
          }
        });
        return { ...d, slots };
      }),
    );
  }

  const styles = StyleSheet.create({
    chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    chip: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    chipText: { fontSize: sc(12), fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: '#fff' },

    dayBlock: {
      marginTop: 10,
      backgroundColor: colors.background,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 12, gap: 6,
    },
    dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dayBlockLabel: {
      fontSize: sc(12), fontWeight: '700', color: colors.teal,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },

    slotRow: { gap: 4 },
    slotInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slotConflict: {
      fontSize: sc(11), color: '#C62828', fontWeight: '500', marginLeft: 4,
    },
    hourPair: { flex: 1, flexDirection: 'row', gap: 8 },
    hourBlock: { flex: 1, gap: 3 },
    hourLabel: { fontSize: sc(11), color: colors.textSecondary, fontWeight: '500' },
    hourControl: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 6, paddingVertical: 3,
      backgroundColor: colors.surface,
    },
    hourControlConflict: { borderColor: '#C62828' },
    hourBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
    },
    hourValue: {
      fontSize: sc(14), fontWeight: '700', color: colors.text,
      minWidth: 44, textAlign: 'center',
    },
    removeBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      marginTop: 18, // align with hour control (offset by label height)
    },

    divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

    addSlotBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start', marginTop: 4,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 8, borderWidth: 1, borderColor: colors.teal,
    },
    addSlotText: { fontSize: sc(12), fontWeight: '600', color: colors.teal },
  });

  return (
    <View>
      {/* Day chip row */}
      <View style={styles.chipsRow}>
        {DAY_LABELS.map((label, idx) => {
          const active = !!value.find((d) => d.dayIndex === idx);
          return (
            <Pressable
              key={idx}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleDay(idx)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Per-day expanded block */}
      {value.map((day) => (
        <View key={day.dayIndex} style={styles.dayBlock}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayBlockLabel}>{DAY_LABELS[day.dayIndex]}</Text>
          </View>

          {day.slots.map((slot, slotIdx) => {
            const conflict = hasConflict(day.slots, slotIdx);
            return (
              <View key={slotIdx} style={styles.slotRow}>
                {slotIdx > 0 && <View style={styles.divider} />}
                <View style={styles.slotInner}>
                  {/* From / To pair */}
                  <View style={styles.hourPair}>
                    {/* From */}
                    <View style={styles.hourBlock}>
                      <Text style={styles.hourLabel}>{t('owner.spot.edit.from')}</Text>
                      <View style={[styles.hourControl, conflict && styles.hourControlConflict]}>
                        <Pressable
                          style={styles.hourBtn}
                          onPress={() => updateHour(day.dayIndex, slotIdx, 'startHour', -1)}
                        >
                          <Ionicons name="remove" size={sc(14)} color={colors.text} />
                        </Pressable>
                        <Text style={styles.hourValue}>{fmt(slot.startHour)}</Text>
                        <Pressable
                          style={styles.hourBtn}
                          onPress={() => updateHour(day.dayIndex, slotIdx, 'startHour', +1)}
                        >
                          <Ionicons name="add" size={sc(14)} color={colors.text} />
                        </Pressable>
                      </View>
                    </View>

                    {/* To */}
                    <View style={styles.hourBlock}>
                      <Text style={styles.hourLabel}>{t('owner.spot.edit.to')}</Text>
                      <View style={[styles.hourControl, conflict && styles.hourControlConflict]}>
                        <Pressable
                          style={styles.hourBtn}
                          onPress={() => updateHour(day.dayIndex, slotIdx, 'endHour', -1)}
                        >
                          <Ionicons name="remove" size={sc(14)} color={colors.text} />
                        </Pressable>
                        <Text style={styles.hourValue}>{fmt(slot.endHour)}</Text>
                        <Pressable
                          style={styles.hourBtn}
                          onPress={() => updateHour(day.dayIndex, slotIdx, 'endHour', +1)}
                        >
                          <Ionicons name="add" size={sc(14)} color={colors.text} />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Remove slot button (only shown when there are 2+ slots) */}
                  {day.slots.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeSlot(day.dayIndex, slotIdx)}
                      accessibilityLabel={t('owner.availability.removeSlot')}
                    >
                      <Ionicons name="trash-outline" size={sc(14)} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {conflict && (
                  <Text style={styles.slotConflict}>
                    {t('owner.availability.slotConflict')}
                  </Text>
                )}
              </View>
            );
          })}

          {/* Add slot button */}
          <TouchableOpacity
            style={styles.addSlotBtn}
            onPress={() => addSlot(day.dayIndex)}
            accessibilityLabel={t('owner.availability.addSlot')}
          >
            <Ionicons name="add" size={sc(14)} color={colors.teal} />
            <Text style={styles.addSlotText}>{t('owner.availability.addSlot')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ── Conversion helpers ────────────────────────────────────────────────────────

import { ScheduleEntry } from '@/src/types';

/**
 * Converts the picker's DayScheduleGroup[] into the flat ScheduleEntry[]
 * that the backend (and parkingService) expect.
 */
export function dayGroupsToEntries(groups: DayScheduleGroup[]): ScheduleEntry[] {
  return groups.flatMap((g) =>
    g.slots.map((s) => ({ dayOfWeek: g.dayIndex, startHour: s.startHour, endHour: s.endHour })),
  );
}

/**
 * Converts the flat ScheduleEntry[] from the backend into DayScheduleGroup[]
 * for the picker.
 */
export function entriesToDayGroups(entries: ScheduleEntry[]): DayScheduleGroup[] {
  const map = new Map<number, TimeSlot[]>();
  for (const e of entries) {
    const slots = map.get(e.dayOfWeek) ?? [];
    slots.push({ startHour: e.startHour, endHour: e.endHour });
    map.set(e.dayOfWeek, slots);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, slots]) => ({
      dayIndex,
      slots: slots.slice().sort((a, b) => a.startHour - b.startHour),
    }));
}
