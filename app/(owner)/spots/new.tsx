import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { AvailabilityPicker, DaySchedule } from '@/src/components/AvailabilityPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { createParkingSpot } from '@/src/services/parkingService';
import { t, useLanguage } from '@/src/i18n';

/** Default Mon–Fri, 08:00–22:00 */
const DEFAULT_SCHEDULE: DaySchedule[] = [0, 1, 2, 3, 4].map((dayIndex) => ({
  dayIndex,
  startHour: 8,
  endHour: 22,
}));

/** Serialise DaySchedule[] to a human-readable schedule string */
function buildScheduleString(days: DaySchedule[]): string {
  if (days.length === 0) return '';
  const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return days
    .map((d) => `${DAY_LABELS[d.dayIndex]} ${fmt(d.startHour)}–${fmt(d.endHour)}`)
    .join(', ');
}

export default function NewSpot() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const user = useSessionStore((s) => s.user);

  const [address, setAddress] = useState('');
  const [covered, setCovered] = useState(true);
  const [price, setPrice] = useState('');
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    if (!user || !address.trim() || !price.trim()) {
      alert(t('owner.spot.new.requiredFields'));
      return;
    }
    if (schedule.length === 0) {
      alert(t('owner.spot.new.requiredSchedule'));
      return;
    }

    try {
      setPublishing(true);
      await createParkingSpot({
        title: address.split(',')[0] || address,
        address: address.trim(),
        covered,
        pricePerHour: Number(price),
        // El backend sólo guarda el horario como texto libre por ahora (no
        // hay franjas horarias estructuradas por día todavía) -- se manda
        // el resumen legible que arma el AvailabilityPicker.
        schedule: buildScheduleString(schedule),
        description: description.trim() || undefined,
      });
      router.back();
    } catch {
      alert(t('owner.spot.new.errorPublish'));
      setPublishing(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    scroll: { padding: 16, gap: 8, paddingBottom: 40 },

    photoBox: {
      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
      borderRadius: 10, height: 90,
      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    photoPlus: { fontSize: 24, color: colors.textSecondary },

    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, fontSize: 15, marginBottom: 4, color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },

    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    toggle: {
      flex: 1, borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    },
    toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toggleText: { color: colors.text },
    toggleTextActive: { color: colors.white, fontWeight: '600' },

    sectionLabel: { marginBottom: 4 },
    button: { marginTop: 16 },
  });

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={typography.caption}>{t('owner.spot.new.photos')}</Text>
        <Pressable style={styles.photoBox}>
          <Text style={styles.photoPlus}>+</Text>
          <Text style={typography.caption}>{t('owner.spot.new.photosTap')}</Text>
        </Pressable>

        <Text style={typography.caption}>{t('owner.spot.new.address')}</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} />

        <Text style={typography.caption}>{t('owner.spot.new.type')}</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, covered && styles.toggleActive]}
            onPress={() => setCovered(true)}
          >
            <Text style={covered ? styles.toggleTextActive : styles.toggleText}>
              {t('owner.spot.new.covered')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, !covered && styles.toggleActive]}
            onPress={() => setCovered(false)}
          >
            <Text style={!covered ? styles.toggleTextActive : styles.toggleText}>
              {t('owner.spot.new.uncovered')}
            </Text>
          </Pressable>
        </View>

        <Text style={typography.caption}>{t('owner.spot.new.pricePerHour')}</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          placeholder="$1.200"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[typography.caption, styles.sectionLabel]}>
          {t('owner.spot.new.availability')}
        </Text>
        <AvailabilityPicker value={schedule} onChange={setSchedule} />

        <Text style={typography.caption}>{t('owner.spot.new.description')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder={t('owner.spot.new.descriptionPlaceholder')}
          placeholderTextColor={colors.textSecondary}
        />

        <Button
          title={publishing ? t('owner.spot.new.publishing') : t('owner.spot.new.publish')}
          onPress={publish}
          disabled={publishing}
          style={styles.button}
        />
      </ScrollView>
    </Screen>
  );
}
