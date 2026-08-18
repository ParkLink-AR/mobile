/**
 * AvailabilityPicker
 *
 * Renders a row of day chips (Lu–Do). Each active day expands to show
 * independent From/To hour controls. The data model is an array of
 * DaySchedule objects — one per active day.
 */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';

export interface DaySchedule {
  /** 0 = Monday … 6 = Sunday */
  dayIndex: number;
  startHour: number;
  endHour: number;
}

interface AvailabilityPickerProps {
  value: DaySchedule[];
  onChange: (next: DaySchedule[]) => void;
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmt(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

export function AvailabilityPicker({ value, onChange }: AvailabilityPickerProps) {
  const colors = useThemeColors();

  function toggleDay(idx: number) {
    const exists = value.find((d) => d.dayIndex === idx);
    if (exists) {
      onChange(value.filter((d) => d.dayIndex !== idx));
    } else {
      // Insert sorted, default 08:00–22:00
      const next = [...value, { dayIndex: idx, startHour: 8, endHour: 22 }]
        .sort((a, b) => a.dayIndex - b.dayIndex);
      onChange(next);
    }
  }

  function updateHour(
    dayIndex: number,
    field: 'startHour' | 'endHour',
    delta: number,
  ) {
    onChange(
      value.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        if (field === 'startHour') {
          const next = clamp(d.startHour + delta, 0, d.endHour - 1);
          return { ...d, startHour: next };
        } else {
          const next = clamp(d.endHour + delta, d.startHour + 1, 23);
          return { ...d, endHour: next };
        }
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
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: '#fff' },

    dayBlock: {
      marginTop: 10,
      backgroundColor: colors.background,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 12, gap: 8,
    },
    dayBlockLabel: {
      fontSize: 12, fontWeight: '700', color: colors.teal,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    hourRow: { flexDirection: 'row', gap: 12 },
    hourBlock: { flex: 1, gap: 4 },
    hourLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
    hourControl: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 6, paddingVertical: 3,
      backgroundColor: colors.surface,
    },
    hourBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
    },
    hourValue: {
      fontSize: 14, fontWeight: '700', color: colors.text,
      minWidth: 44, textAlign: 'center',
    },
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

      {/* Per-day hour controls */}
      {value.map((day) => (
        <View key={day.dayIndex} style={styles.dayBlock}>
          <Text style={styles.dayBlockLabel}>{DAY_LABELS[day.dayIndex]}</Text>
          <View style={styles.hourRow}>
            {/* From */}
            <View style={styles.hourBlock}>
              <Text style={styles.hourLabel}>Desde</Text>
              <View style={styles.hourControl}>
                <Pressable
                  style={styles.hourBtn}
                  onPress={() => updateHour(day.dayIndex, 'startHour', -1)}
                >
                  <Ionicons name="remove" size={14} color={colors.text} />
                </Pressable>
                <Text style={styles.hourValue}>{fmt(day.startHour)}</Text>
                <Pressable
                  style={styles.hourBtn}
                  onPress={() => updateHour(day.dayIndex, 'startHour', +1)}
                >
                  <Ionicons name="add" size={14} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {/* To */}
            <View style={styles.hourBlock}>
              <Text style={styles.hourLabel}>Hasta</Text>
              <View style={styles.hourControl}>
                <Pressable
                  style={styles.hourBtn}
                  onPress={() => updateHour(day.dayIndex, 'endHour', -1)}
                >
                  <Ionicons name="remove" size={14} color={colors.text} />
                </Pressable>
                <Text style={styles.hourValue}>{fmt(day.endHour)}</Text>
                <Pressable
                  style={styles.hourBtn}
                  onPress={() => updateHour(day.dayIndex, 'endHour', +1)}
                >
                  <Ionicons name="add" size={14} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
