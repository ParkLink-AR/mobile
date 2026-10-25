import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { formatShortDate } from '@/src/services/bookingDates';
import { ParkingSpot } from '@/src/types';
import { useScale } from '@/src/theme/typography';

// Todo lo de esta pantalla es 100% mockeado a propósito -- es para una demo/
// presentación, no hay ninguna liquidación ni ingreso real detrás. Las
// cocheras sí son las reales del propietario (getParkingSpotsForOwner) para
// que la demo se sienta propia; los montos que se les asigna son inventados.
//
// "Este mes" se calcula sumando estos montos por cochera (no al revés) --
// son números con centavos/no redondos a propósito, para que no se vea tan
// evidentemente mockeado como "$660.000" en la demo.
const SPOT_AMOUNT_TEMPLATE = [329_875.4, 198_430.15, 87_215.9, 42_180.25];
const NO_SPOTS_FALLBACK_AMOUNT = 371_540.2;
const TOTAL_BOOKINGS = 87;
const AVG_OCCUPANCY = 72;
// Factor de crecimiento mes a mes (mes[i] -> mes[i+1]), el último paso (a
// "este mes") fija el +18% del chip de tendencia. Se aplican relativos a
// "este mes" (no montos fijos) para que la curva de los 5 meses previos
// siempre quede por debajo sin importar cuántas cocheras reales tenga la
// cuenta -- un monto fijo podía terminar *más alto* que "este mes" si el
// propietario tenía pocas cocheras, mostrando una tendencia negativa.
const MONTH_GROWTH_RATIOS = [1.08, 1.1, 1.12, 1.15, 1.18];

function fallbackSpotAmount(index: number): number {
  return Math.max(8_000, 35_000 - index * 6_000 + ((index * 733) % 900) + 0.5);
}

function getSpotAmounts(count: number): number[] {
  return Array.from({ length: count }, (_, i) => SPOT_AMOUNT_TEMPLATE[i] ?? fallbackSpotAmount(i));
}

function buildMonthlySeries(currentMonth: number): number[] {
  const months = [currentMonth];
  for (let i = MONTH_GROWTH_RATIOS.length - 1; i >= 0; i--) {
    months.unshift(months[0] / MONTH_GROWTH_RATIOS[i]);
  }
  return months;
}

function lastSixMonthLabels(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
  });
}

function lastDayOfMonthISO(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

const money = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OwnerFinances() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  // Hasta saber cuántas cocheras tiene el propietario no se muestra ningún monto: antes se veían
  // tres totales distintos seguidos (sin cocheras, con las primeras, con todas) hasta que
  // terminaba de cargar.
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getParkingSpotsForOwner(user.id)
        .then(setSpots)
        .catch(() => undefined)
        .finally(() => setLoaded(true));
    }, [user?.id]),
  );

  if (!user) return null;

  if (!loaded) {
    return (
      <Screen
        style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}
        edges={['left', 'right', 'bottom']}
      >
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  const spotAmounts = getSpotAmounts(spots.length);
  const thisMonth = spotAmounts.length > 0
    ? spotAmounts.reduce((a, b) => a + b, 0)
    : NO_SPOTS_FALLBACK_AMOUNT;
  const monthlyEarnings = buildMonthlySeries(thisMonth);
  const prevMonth = monthlyEarnings[monthlyEarnings.length - 2];
  const totalSixMonths = monthlyEarnings.reduce((a, b) => a + b, 0);
  const trendPct = Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
  const monthLabels = lastSixMonthLabels();
  const maxMonth = Math.max(...monthlyEarnings);
  const CHART_HEIGHT = 100;
  // Mismo monto que "Este mes"/la suma del desglose por cochera -- todos
  // representan la misma plata generada este mes, solo vista desde ángulos
  // distintos (total, por cochera, próximo pago).
  const nextSettlementAmount = thisMonth;
  const nextSettlementDate = lastDayOfMonthISO();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 48, gap: 16 },
    heroCard: { gap: 6, backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
    heroLabel: { fontSize: sc(13), color: colors.white, opacity: 0.75 },
    heroValue: { fontSize: sc(30), fontWeight: '800', color: colors.white },
    trendChip: {
      flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4,
      backgroundColor: colors.success + '33', borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
    },
    trendChipText: { fontSize: sc(12), fontWeight: '700', color: colors.success },
    // With large text the month's amount doesn't fit a third of the width: it takes a row of its own.
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCardWide: { flexBasis: '100%' },
    statCard: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4,
    },
    statValue: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    statLabel: { fontSize: sc(11), color: colors.textSecondary },
    sectionTitle: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4,
    },
    chartCard: { gap: 4 },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_HEIGHT, marginTop: 12 },
    chartBarWrap: { flex: 1, alignItems: 'center', gap: 6 },
    chartBar: { width: 22, borderRadius: 6 },
    chartBarLabel: { fontSize: sc(11), color: colors.textSecondary, textTransform: 'capitalize' },
    spotRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, gap: 12,
    },
    spotDivider: { height: 1, backgroundColor: colors.border },
    spotTitle: { fontSize: sc(14), fontWeight: '600', color: colors.text, flex: 1 },
    spotAmount: { fontSize: sc(14), fontWeight: '700', color: colors.teal, flexShrink: 0 },
    emptyText: { fontSize: sc(13), color: colors.textSecondary },
    settlementCard: { gap: 10 },
    settlementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settlementAmount: { fontSize: sc(20), fontWeight: '700', color: colors.text },
    settlementDate: { fontSize: sc(13), color: colors.textSecondary },
    settlementCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderRadius: 10, borderWidth: 1.5, borderColor: colors.teal, paddingVertical: 10,
    },
    settlementCtaText: { fontSize: sc(14), fontWeight: '600', color: colors.teal },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>{t('owner.finances.heroLabel')}</Text>
          <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{money(totalSixMonths)}</Text>
          <View style={styles.trendChip}>
            <Ionicons name="trending-up" size={sc(13)} color={colors.success} />
            <Text style={styles.trendChipText}>+{trendPct}% {t('owner.finances.trendLabel')}</Text>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, scale > 1 && styles.statCardWide]}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{money(thisMonth)}</Text>
            <Text style={styles.statLabel}>{t('owner.finances.thisMonth')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{TOTAL_BOOKINGS}</Text>
            <Text style={styles.statLabel}>{t('owner.finances.totalBookings')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{AVG_OCCUPANCY}%</Text>
            <Text style={styles.statLabel}>{t('owner.finances.avgOccupancy')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('owner.finances.chartTitle')}</Text>
        <Card style={styles.chartCard}>
          <View style={styles.chartRow}>
            {monthlyEarnings.map((amount, i) => {
              const isCurrent = i === monthlyEarnings.length - 1;
              const height = Math.max(16, Math.round((amount / maxMonth) * CHART_HEIGHT));
              return (
                <View key={monthLabels[i] + i} style={styles.chartBarWrap}>
                  <View
                    style={[
                      styles.chartBar,
                      { height, backgroundColor: isCurrent ? colors.teal : colors.teal + '55' },
                    ]}
                  />
                  <Text style={styles.chartBarLabel}>{monthLabels[i]}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Text style={styles.sectionTitle}>{t('owner.finances.bySpotTitle')}</Text>
        <Card>
          {spots.length === 0 ? (
            <Text style={styles.emptyText}>{t('owner.finances.bySpotEmpty')}</Text>
          ) : (
            spots.map((spot, i) => (
              <View key={spot.id}>
                {i > 0 && <View style={styles.spotDivider} />}
                <View style={styles.spotRow}>
                  <Text style={styles.spotTitle}>{spot.title}</Text>
                  <Text style={styles.spotAmount}>{money(spotAmounts[i])}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <Text style={styles.sectionTitle}>{t('owner.finances.nextSettlementTitle')}</Text>
        <Card style={styles.settlementCard}>
          <View style={styles.settlementRow}>
            <View>
              <Text style={styles.settlementAmount} numberOfLines={1} adjustsFontSizeToFit>{money(nextSettlementAmount)}</Text>
              <Text style={styles.settlementDate}>{formatShortDate(nextSettlementDate)}</Text>
            </View>
            <Ionicons name="calendar-outline" size={sc(28)} color={colors.textSecondary} />
          </View>
          <Pressable
            style={({ pressed }) => [styles.settlementCta, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push(`${group}/settlements`)}
          >
            <Text style={styles.settlementCtaText}>{t('settlements.title')}</Text>
            <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}
