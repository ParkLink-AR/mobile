import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { Button } from '@/src/components/Button';
import { DatePickerField } from '@/src/components/DatePickerField';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { BlockedDateRange, getParkingSpotDetail, setBlockedDatesApi } from '@/src/api/parking';
import { useSpotsStore } from '@/src/store/useSpotsStore';
import { ApiError } from '@/src/api/client';
import { formatLongDate } from '@/src/services/bookingDates';

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * "Fechas bloqueadas": whole days the owner closes the spot by hand (vacations, they use it
 * that day) -- nobody can book it then, hourly or within a stay, whatever the weekly
 * schedule says. A day that already has a booking can't be closed: it has to be cancelled
 * first.
 */
export default function BlockedDates() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ranges, setRanges] = useState<BlockedDateRange[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markUpdated = useSpotsStore((s) => s.markUpdated);

  useEffect(() => {
    if (!id) return;
    getParkingSpotDetail(id)
      .then((spot) => setRanges(spot.blockedDates ?? []))
      .catch(() => setRanges([]));
  }, [id]);

  const save = useCallback(
    async (next: BlockedDateRange[]) => {
      if (!id) return false;
      setSaving(true);
      setError(null);
      try {
        const updated = await setBlockedDatesApi(id, next);
        setRanges(updated.blockedDates ?? next);
        markUpdated();
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : t('owner.blocked.error'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, markUpdated],
  );

  async function add() {
    if (!ranges || !from) return;
    const end = to && to >= from ? to : from;
    if (await save([...ranges, { from, to: end }])) {
      setFrom('');
      setTo('');
    }
  }

  function remove(index: number) {
    if (!ranges) return;
    save(ranges.filter((_, i) => i !== index));
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },
    intro: { fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(20) },
    card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
    sectionLabel: { fontSize: sc(11), fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rangeText: { flex: 1, fontSize: sc(14), color: colors.text, fontWeight: '600', lineHeight: sc(20) },
    empty: { fontSize: sc(14), color: colors.textSecondary },
    fieldLabel: { fontSize: sc(13), color: colors.textSecondary, fontWeight: '600' },
    dateInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
      backgroundColor: colors.background,
    },
    error: { fontSize: sc(13), color: '#C62828', lineHeight: sc(18) },
  });

  if (ranges === null) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
      </Screen>
    );
  }

  const minimumDate = new Date(`${todayISO()}T00:00:00`);

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('owner.blocked.intro')}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('owner.blocked.current')}</Text>
          {ranges.length === 0 ? (
            <Text style={styles.empty}>{t('owner.blocked.none')}</Text>
          ) : (
            ranges.map((range, index) => (
              <View key={`${range.from}-${range.to}`} style={styles.row}>
                <Ionicons name="close-circle-outline" size={sc(18)} color={colors.warning} />
                <Text style={styles.rangeText}>
                  {range.from === range.to
                    ? formatLongDate(range.from)
                    : t('owner.blocked.range', { from: formatLongDate(range.from), to: formatLongDate(range.to) })}
                </Text>
                <Pressable onPress={() => remove(index)} disabled={saving} accessibilityLabel={t('owner.blocked.remove')} hitSlop={8}>
                  <Ionicons name="trash-outline" size={sc(18)} color="#C62828" />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('owner.blocked.add')}</Text>
          <Text style={styles.fieldLabel}>{t('owner.blocked.from')}</Text>
          <DatePickerField value={from} onChange={setFrom} placeholder={t('spot.datePlaceholder')} minimumDate={minimumDate} style={styles.dateInput} />
          <Text style={styles.fieldLabel}>{t('owner.blocked.to')}</Text>
          <DatePickerField
            value={to}
            onChange={setTo}
            placeholder={t('owner.blocked.toPlaceholder')}
            minimumDate={from ? new Date(`${from}T00:00:00`) : minimumDate}
            style={styles.dateInput}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={saving ? t('owner.spot.edit.saving') : t('owner.blocked.addButton')} onPress={add} disabled={!from || saving} />
        </View>
      </ScrollView>
    </Screen>
  );
}
