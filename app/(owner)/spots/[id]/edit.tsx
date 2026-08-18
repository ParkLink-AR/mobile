import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { RatingStars } from '@/src/components/RatingStars';
import { AvailabilityPicker, DaySchedule } from '@/src/components/AvailabilityPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getParkingSpotDetail, updateParkingSpot } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

export default function EditSpot() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [covered, setCovered] = useState(true);
  const [schedule, setSchedule] = useState<DaySchedule[]>([0, 1, 2, 3, 4].map((d) => ({ dayIndex: d, startHour: 8, endHour: 22 })));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => {
      if (!s) return;
      setSpot(s);
      setPrice(String(s.pricePerHour));
      setDescription(s.description ?? '');
      setCovered(s.covered);
      const storedDays: DaySchedule[] = (s as any).activeDays;
      if (storedDays?.length) {
        setSchedule(storedDays);
      } else {
        // Derive from global start/end, defaulting to Mon–Fri
        setSchedule([0, 1, 2, 3, 4].map((d) => ({
          dayIndex: d,
          startHour: s.scheduleStartHour ?? 8,
          endHour: s.scheduleEndHour ?? 22,
        })));
      }
    });
  }, [id]);

  if (!spot) return null;

  async function save() {
    if (schedule.length === 0) {
      alert(t('owner.spot.edit.invalidHours'));
      return;
    }
    const parsedPrice = Number(price);
    if (!price.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
      alert(t('owner.spot.edit.invalidPrice'));
      return;
    }
    const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
    const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
    const scheduleString = schedule
      .map((d) => `${DAY_LABELS[d.dayIndex]} ${fmt(d.startHour)}–${fmt(d.endHour)}`)
      .join(', ');
    const globalStart = Math.min(...schedule.map((d) => d.startHour));
    const globalEnd = Math.max(...schedule.map((d) => d.endHour));
    try {
      setSaving(true);
      const updated = await updateParkingSpot(id, {
        pricePerHour: parsedPrice,
        description: description.trim(),
        scheduleStartHour: globalStart,
        scheduleEndHour: globalEnd,
        activeDays: schedule,
        schedule: scheduleString,
      });
      if (updated) setSpot(updated);
      router.back();
    } catch {
      alert(t('owner.spot.edit.errorSave'));
      setSaving(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    photo: { width: '100%', height: 190 },
    body: { padding: 16, gap: 14 },

    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 6,
    },
    spotTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    spotAddress: { fontSize: 13, color: colors.textSecondary },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },

    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 12, fontSize: 15, color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },

    toggleRow: { flexDirection: 'row', gap: 8 },
    toggle: {
      flex: 1, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    },
    toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    toggleTextActive: { color: colors.surface, fontWeight: '700' },

    saveBtn: { marginTop: 4 },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo */}
        <Image source={{ uri: spot.photoUrl }} style={styles.photo} />

        <View style={styles.body}>
          {/* Spot info (read-only) */}
          <View style={styles.infoCard}>
            <Text style={styles.spotTitle}>{spot.title}</Text>
            <Text style={styles.spotAddress}>{spot.address}</Text>
            <RatingStars rating={spot.rating} count={spot.reviewCount} />
          </View>

          {/* Price */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.pricePerHour')}</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="1200"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Type */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.new.type')}</Text>
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
          </View>

          {/* Availability */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.availability')}</Text>
            <AvailabilityPicker value={schedule} onChange={setSchedule} />
          </View>

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('owner.spot.edit.description')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder={t('owner.spot.new.descriptionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Button
            title={saving ? t('owner.spot.edit.saving') : t('owner.spot.edit.save')}
            onPress={save}
            disabled={saving}
            style={styles.saveBtn}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
