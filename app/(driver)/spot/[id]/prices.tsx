import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { t, useLanguage } from '@/src/i18n';
import { getParkingSpotDetail, HALF_DAY_HOURS } from '@/src/services/parkingService';
import { formatShortDate } from '@/src/services/bookingDates';
import { formatPesos, getDriverVisiblePrice } from '@/src/services/utils';
import { todayArtDateISO } from '@/src/services/dateUtils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { VehicleType, VEHICLE_TYPE_EXAMPLE_KEYS, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { ParkingSpot } from '@/src/types';

interface PriceRow {
  label: string;
  // "(Hilux, Ranger, Amarok, S10)" under the vehicle's name, so nobody has to guess what an SUV or a pick-up is.
  hint?: string;
  values: (number | null | undefined)[];
}

/**
 * Every price a spot has, in full: by the hour, the half-day and the stay (day / week / month), one row per
 * vehicle type when it prices by vehicle -- plus the stay's dates and longest length. The spot's own screen only
 * shows the headline price of each, with a link here.
 */
export default function SpotPrices() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  const [spot, setSpot] = useState<ParkingSpot | null | undefined>(undefined);

  useEffect(() => {
    getParkingSpotDetail(id)
      .then((s) => setSpot(s ?? null))
      .catch(() => setSpot(null));
  }, [id]);

  const styles = StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    empty: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center' },
    spotTitle: { fontSize: sc(20), fontWeight: '700', color: colors.text },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    sectionIcon: {
      width: sc(32), height: sc(32), borderRadius: sc(16), alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.teal + '1A',
    },
    sectionTitle: { flex: 1, fontSize: sc(16), fontWeight: '700', color: colors.text },
    sectionNote: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18), marginBottom: 6 },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
    // The label wraps if it has to; the price keeps its own width and stays on one line.
    rowLabelBox: { flex: 1 },
    rowLabel: { fontSize: sc(15), color: colors.text },
    rowHint: { fontSize: sc(12), lineHeight: sc(16), color: colors.textSecondary, marginTop: 1 },
    cell: { flexShrink: 0, marginLeft: 12, textAlign: 'right' },
    rowStack: { flex: 1, gap: 6 },
    rowLabelStack: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    cellsRow: { flexDirection: 'row', gap: 8 },
    cellStack: { flex: 1, minWidth: 0, gap: 2 },
    cellCaption: { fontSize: sc(11), fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    price: { fontSize: sc(15), fontWeight: '700', color: colors.teal, fontVariant: ['tabular-nums'] },
    noPrice: { fontSize: sc(15), color: colors.textSecondary },
    facts: { marginTop: 8, gap: 4 },
    fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    factIcon: { marginTop: 1 },
    factText: { flex: 1, fontSize: sc(13), lineHeight: sc(18), color: colors.text },
    footnote: { fontSize: sc(12), color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  });

  if (spot === undefined) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }
  if (spot === null) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.empty}>{t('spot.prices.error')}</Text>
      </Screen>
    );
  }

  const visible = (price: number | null | undefined) =>
    typeof price === 'number' && price > 0 ? formatPesos(getDriverVisiblePrice(price, commissionRatePercent)) : null;
  const vehicleLabel = (vt: VehicleType) => t(VEHICLE_TYPE_LABEL_KEYS[vt]);
  // Motos and bicycles need no examples.
  const vehicleHint = (vt: VehicleType) =>
    vt === 'motorcycle' || vt === 'bicycle' ? undefined : `(${t(VEHICLE_TYPE_EXAMPLE_KEYS[vt])})`;

  const hourlyRows: PriceRow[] = spot.pricePerHourByVehicleType
    ? spot.vehicleTypes.map((vt) => ({ label: vehicleLabel(vt), hint: vehicleHint(vt), values: [spot.pricePerHourByVehicleType?.[vt]] }))
    : [{ label: t('spot.prices.perHour'), values: [spot.pricePerHour] }];

  const halfDayRows: PriceRow[] = spot.stayPricesByVehicleType
    ? spot.vehicleTypes.map((vt) => ({
        label: vehicleLabel(vt),
        hint: vehicleHint(vt),
        values: [spot.stayPricesByVehicleType?.[vt]?.halfDay],
      }))
    : [{ label: t('spot.prices.perHalfDay'), values: [spot.pricePerHalfDay] }];

  const stayByVehicle = !!spot.stayPricesByVehicleType;
  const stayRows: PriceRow[] = stayByVehicle
    ? spot.vehicleTypes.map((vt) => {
        const rates = spot.stayPricesByVehicleType?.[vt];
        return { label: vehicleLabel(vt), hint: vehicleHint(vt), values: [rates?.day, rates?.week, rates?.month] };
      })
    : [
        { label: t('spot.prices.perDay'), values: [spot.pricePerDay] },
        { label: t('spot.prices.perWeek'), values: [spot.pricePerWeek] },
        { label: t('spot.prices.perMonth'), values: [spot.pricePerMonth] },
      ];

  const stayFrom = spot.stayAvailableFrom && spot.stayAvailableFrom > todayArtDateISO() ? spot.stayAvailableFrom : todayArtDateISO();
  const stayFacts = [
    spot.stayAvailableUntil
      ? t('spot.mode.window', { from: formatShortDate(stayFrom), to: formatShortDate(spot.stayAvailableUntil) })
      : spot.stayAvailableFrom && spot.stayAvailableFrom > todayArtDateISO()
        ? t('spot.mode.from', { from: formatShortDate(spot.stayAvailableFrom) })
        : null,
    spot.maxStayDays ? t('spot.mode.maxDays', { days: String(spot.maxStayDays) }) : null,
  ].filter((fact): fact is string => !!fact);

  const section = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    note: string | null,
    rows: PriceRow[],
    // Captions of the prices of each row, when there's more than one (day / week / month).
    columns: string[] | null,
    facts: string[] = [],
  ) => (
    <Card>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={sc(17)} color={colors.teal} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      {rows.map((row) =>
        columns ? (
          // Several prices per vehicle (day / week / month): the name on its own line and the prices under it across
          // the whole width, each with its caption -- side by side with the name they don't fit with large text.
          <View key={row.label} style={styles.row}>
            <View style={styles.rowStack}>
              <View>
                <Text style={styles.rowLabelStack}>{row.label}</Text>
                {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
              </View>
              <View style={styles.cellsRow}>
                {row.values.map((value, index) => {
                  const price = visible(value);
                  return (
                    <View key={index} style={styles.cellStack}>
                      <Text style={styles.cellCaption} numberOfLines={1} adjustsFontSizeToFit>{columns[index]}</Text>
                      <Text style={price ? styles.price : styles.noPrice} numberOfLines={1} adjustsFontSizeToFit>
                        {price ?? '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : (
          <View key={row.label} style={styles.row}>
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
            </View>
            {row.values.map((value, index) => {
              const price = visible(value);
              return (
                <Text key={index} style={[styles.cell, price ? styles.price : styles.noPrice]} numberOfLines={1}>
                  {price ?? '—'}
                </Text>
              );
            })}
          </View>
        ),
      )}
      {facts.length > 0 && (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact} style={styles.fact}>
              <Ionicons name="information-circle-outline" size={sc(15)} color={colors.teal} style={styles.factIcon} />
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  return (
    <Screen style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.spotTitle}>{spot.title}</Text>
        {spot.hourlyEnabled &&
          section('time-outline', t('spot.mode.hourly'), t('spot.mode.hourlyDetail'), hourlyRows, null)}
        {spot.halfDayEnabled &&
          section('hourglass-outline', t('spot.mode.halfDay'), t('spot.mode.halfDayDetail', { hours: String(HALF_DAY_HOURS) }),
            halfDayRows, null)}
        {spot.stayEnabled &&
          section('calendar-outline', t('spot.mode.stay'), null, stayRows,
            stayByVehicle ? [t('spot.prices.colDay'), t('spot.prices.colWeek'), t('spot.prices.colMonth')] : null,
            stayFacts)}
        <Text style={styles.footnote}>{t('spot.prices.footnote')}</Text>
      </ScrollView>
    </Screen>
  );
}
