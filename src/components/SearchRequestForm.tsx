import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Chip } from '@/src/components/Chip';
import { DatePickerField } from '@/src/components/DatePickerField';
import { DropdownSelect } from '@/src/components/DropdownSelect';
import { vehicleName } from '@/src/components/VehicleIdentity';
import { getVehicles } from '@/src/api/auth';
import { VEHICLE_TYPES, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { todayArtDateISO } from '@/src/services/dateUtils';
import { PROVINCES, SearchRequest, isSearchRequestComplete } from '@/src/services/searchRequest';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { t } from '@/src/i18n';
import type { Vehicle } from '@/src/types';

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
  const user = useSessionStore((s) => s.user);
  const today = todayArtDateISO();

  const [provinceId, setProvinceId] = useState(initial?.provinceId ?? PROVINCES[0].id);
  const [mode, setMode] = useState<'hourly' | 'stay'>(initial?.mode ?? 'hourly');
  const [date, setDate] = useState(initial?.date ?? today);
  const [fromHour, setFromHour] = useState(initial?.fromHour ?? 8);
  const [toHour, setToHour] = useState(initial?.toHour ?? 9);
  const [stayFrom, setStayFrom] = useState(initial?.stayFrom ?? '');
  const [stayTo, setStayTo] = useState(initial?.stayTo ?? '');
  const [stayHour, setStayHour] = useState(initial?.stayHour ?? 8);
  const [vehicleType, setVehicleType] = useState(initial?.vehicleType ?? null);
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? null);
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    getVehicles(user.id)
      .then((list) => setMyVehicles(list.filter((v) => v.type !== null)))
      .catch(() => setMyVehicles([]));
  }, [user?.id]);

  const request: SearchRequest = { provinceId, mode, date, fromHour, toHour, stayFrom, stayTo, stayHour, vehicleType, vehicleId };

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
    hourControl: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: colors.background,
    },
    hourBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hourValue: { fontSize: sc(14), fontWeight: '700', color: colors.text, minWidth: 44, textAlign: 'center' },
    submit: { marginTop: 28 },
  });

  function renderHourStepper(label: string, value: number, onMinus: () => void, onPlus: () => void) {
    return (
      <View key={label} style={styles.field}>
        <Text style={styles.smallLabel}>{label}</Text>
        <View style={styles.hourControl}>
          <TouchableOpacity style={styles.hourBtn} onPress={onMinus}>
            <Ionicons name="remove" size={sc(14)} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.hourValue}>{String(value % 24).padStart(2, '0')}:00</Text>
          <TouchableOpacity style={styles.hourBtn} onPress={onPlus}>
            <Ionicons name="add" size={sc(14)} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          {renderHourStepper(
            t('search.request.checkInHour'),
            stayHour,
            () => setStayHour((h) => Math.max(0, h - 1)),
            () => setStayHour((h) => Math.min(23, h + 1)),
          )}
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
            {renderHourStepper(
              t('search.filters.from'),
              fromHour,
              () => setFromHour((h) => Math.max(0, h - 1)),
              () => {
                const next = Math.min(fromHour + 1, 23);
                setFromHour(next);
                if (toHour <= next) setToHour(next + 1);
              },
            )}
            {renderHourStepper(
              t('search.filters.until'),
              toHour,
              () => setToHour((h) => Math.max(fromHour + 1, h - 1)),
              () => setToHour((h) => Math.min(24, h + 1)),
            )}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>{t('search.request.vehicle')}</Text>
      <View style={styles.chipsWrap}>
        {myVehicles.map((vehicle) => (
          <Chip
            key={vehicle.id}
            label={vehicleName(vehicle)}
            selected={vehicleId === vehicle.id}
            onPress={() => {
              setVehicleType(vehicle.type);
              setVehicleId(vehicle.id);
            }}
          />
        ))}
        {VEHICLE_TYPES.map((type) => (
          <Chip
            key={type}
            label={t(VEHICLE_TYPE_LABEL_KEYS[type])}
            selected={vehicleId === null && vehicleType === type}
            onPress={() => {
              setVehicleType(type);
              setVehicleId(null);
            }}
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
