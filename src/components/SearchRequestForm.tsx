import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Button } from '@/src/components/Button';
import { Chip } from '@/src/components/Chip';
import { DatePickerField } from '@/src/components/DatePickerField';
import { DropdownSelect } from '@/src/components/DropdownSelect';
import { HourPickerField } from '@/src/components/HourPickerField';
import { VEHICLE_TYPES, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { earliestBookableHourToday, todayArtDateISO } from '@/src/services/dateUtils';
import { PROVINCES, SearchRequest, isSearchRequestComplete } from '@/src/services/searchRequest';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { t } from '@/src/i18n';

interface Props {
  /** Lo último que se buscó, para no empezar de cero al volver a cambiar la búsqueda. */
  initial: SearchRequest | null;
  onSubmit: (request: SearchRequest) => void;
}

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.id, label: province.name }));

/**
 * First thing a driver sees in the search tab: province (or CABA), when and which vehicle.
 * The map and the spots only show up once this is filled in.
 */
export function SearchRequestForm({ initial, onSubmit }: Props) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const today = todayArtDateISO();
  // Today, hours already gone can't be booked: the earliest start is the current hour.
  const earliestToday = Math.min(earliestBookableHourToday(), 23);

  const [provinceId, setProvinceId] = useState(initial?.provinceId ?? PROVINCES[0].id);
  const [mode, setMode] = useState<'hourly' | 'stay'>(initial?.mode ?? 'hourly');
  const [date, setDate] = useState(initial?.date ?? today);
  const [fromHour, setFromHour] = useState(initial?.fromHour ?? Math.max(8, earliestToday));
  const [toHour, setToHour] = useState(initial?.toHour ?? Math.max(9, earliestToday + 1));
  const [stayFrom, setStayFrom] = useState(initial?.stayFrom ?? '');
  const [stayTo, setStayTo] = useState(initial?.stayTo ?? '');
  const [stayHour, setStayHour] = useState(initial?.stayHour ?? Math.max(8, earliestToday));
  const minFromHour = date === today ? earliestToday : 0;
  const minStayHour = stayFrom === today ? earliestToday : 0;

  // A date or an earlier search can leave hours in the past: move them up to the current one.
  useEffect(() => {
    if (fromHour < minFromHour) {
      setFromHour(minFromHour);
      setToHour((h) => Math.max(h, minFromHour + 1));
    }
  }, [fromHour, minFromHour]);
  useEffect(() => {
    if (stayHour < minStayHour) setStayHour(minStayHour);
  }, [stayHour, minStayHour]);
  const [vehicleType, setVehicleType] = useState(initial?.vehicleType ?? null);

  const request: SearchRequest = { provinceId, mode, date, fromHour, toHour, stayFrom, stayTo, stayHour, vehicleType, vehicleId: null };

  const styles = StyleSheet.create({
    content: { padding: 20, paddingBottom: 40 },
    title: { fontSize: sc(22), fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: sc(14), color: colors.textSecondary, marginTop: 6, lineHeight: sc(20) },
    sectionLabel: {
      fontSize: sc(12),
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 22,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', gap: 10 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    field: { flex: 1, minWidth: 0, gap: 4 },
    smallLabel: { fontSize: sc(11), color: colors.textSecondary, fontWeight: '500' },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: sc(15),
      color: colors.text,
      backgroundColor: colors.background,
    },
    submit: { marginTop: 28 },
  });

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('search.request.title')}</Text>
      <Text style={styles.subtitle}>{t('search.request.subtitle')}</Text>

      <Text style={styles.sectionLabel}>{t('search.request.where')}</Text>
      <View style={styles.row}>
        <DropdownSelect icon="location-outline" options={PROVINCE_OPTIONS} value={provinceId} onChange={setProvinceId} active />
      </View>

      <Text style={styles.sectionLabel}>{t('search.request.when')}</Text>
      <View style={styles.chipsWrap}>
        <Chip label={t('search.request.hourly')} selected={mode === 'hourly'} onPress={() => setMode('hourly')} />
        <Chip label={t('search.request.stay')} selected={mode === 'stay'} onPress={() => setMode('stay')} />
      </View>

      {mode === 'stay' ? (
        <>
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={styles.field}>
            <Text style={styles.smallLabel}>{t('search.filters.checkIn')}</Text>
            <DatePickerField
              value={stayFrom}
              onChange={(value) => {
                setStayFrom(value);
                if (stayTo && stayTo <= value) setStayTo('');
              }}
              placeholder={t('search.filters.datePlaceholderShort')}
              minimumDate={new Date(`${today}T00:00:00`)}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.smallLabel}>{t('search.filters.checkOut')}</Text>
            <DatePickerField
              value={stayTo}
              onChange={setStayTo}
              placeholder={t('search.filters.datePlaceholderShort')}
              minimumDate={new Date(`${stayFrom || today}T00:00:00`)}
              style={styles.input}
            />
          </View>
        </View>
        <View style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.field}>
            <Text style={styles.smallLabel}>{t('search.request.checkInHour')}</Text>
            <HourPickerField
              value={stayHour}
              minHour={minStayHour}
              maxHour={23}
              label={t('search.request.checkInHour')}
              onChange={setStayHour}
              style={styles.input}
            />
          </View>
          <View style={styles.field} />
        </View>
        </>
      ) : (
        <>
          <View style={{ marginTop: 8 }}>
            <DatePickerField
              value={date}
              onChange={setDate}
              placeholder={t('search.request.datePlaceholder')}
              minimumDate={new Date(`${today}T00:00:00`)}
              style={styles.input}
            />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <View style={styles.field}>
              <Text style={styles.smallLabel}>{t('search.filters.from')}</Text>
              <HourPickerField
                value={fromHour}
                minHour={minFromHour}
                maxHour={23}
                label={t('search.filters.from')}
                onChange={(next) => {
                  setFromHour(next);
                  if (toHour <= next) {
                    setToHour(Math.min(24, next + 1));
                  }
                }}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.smallLabel}>{t('search.filters.until')}</Text>
              <HourPickerField
                value={toHour}
                minHour={fromHour + 1}
                maxHour={24}
                label={t('search.filters.until')}
                onChange={setToHour}
                style={styles.input}
              />
            </View>
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>{t('search.request.vehicle')}</Text>
      <View style={styles.chipsWrap}>
        {VEHICLE_TYPES.map((type) => (
          <Chip
            key={type}
            label={t(VEHICLE_TYPE_LABEL_KEYS[type])}
            selected={vehicleType === type}
            onPress={() => setVehicleType(type)}
          />
        ))}
      </View>

      <Button
        title={t('search.request.submit')}
        onPress={() => onSubmit(request)}
        disabled={!isSearchRequestComplete(request)}
        style={styles.submit}
      />
    </ScrollView>
  );
}
