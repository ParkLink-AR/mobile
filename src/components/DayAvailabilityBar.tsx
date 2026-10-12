import { View, Text, StyleSheet } from 'react-native';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { artMidnightForDate } from '@/src/services/dateUtils';
import { formatWeekdayShortDay } from '@/src/services/bookingDates';
import { barTicks, startDateOf, type Interval } from '@/src/services/bookingRange';
import { AvailabilityBar } from '@/src/components/AvailabilityBar';

const TICK_WIDTH = 28;
const DAY_TICK_WIDTH = 56;

interface DayAvailabilityBarProps {
  /** Qué tramo se dibuja: las próximas 24 h desde ahora o un día entero (ver barDomain). */
  domain: Interval;
  /** Lo libre dentro de ese tramo (en verde). */
  free: Interval[];
  /** La reserva elegida (en teal); si pasa del borde se ve hasta ahí. */
  selection: Interval | null;
  /** Se tocó un tramo verde en este instante. */
  onPick: (ms: number) => void;
}

/**
 * Resumen visual de cuándo se puede reservar: la barra de disponibilidad con su guía, las marcas de hora (y el día
 * donde cruza la medianoche) y la leyenda de colores. Si arranca "ahora", lo ya pasado no se muestra.
 */
export function DayAvailabilityBar({ domain, free, selection, onPick }: DayAvailabilityBarProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  const startsNow = domain.startMs !== artMidnightForDate(startDateOf(domain.startMs));
  const ticks = barTicks(domain);
  const midnights = ticks.filter((tick) => tick.midnightDateISO !== null).map((tick) => tick.fraction);

  const styles = StyleSheet.create({
    title: { fontSize: sc(14), fontWeight: '600', color: colors.text, marginBottom: 2 },
    ticks: { height: sc(16), marginTop: -4 },
    tick: { position: 'absolute', alignItems: 'center' },
    tickText: { fontSize: sc(11), color: colors.textSecondary },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontSize: sc(12), color: colors.textSecondary },
  });

  return (
    <View>
      <Text style={styles.title}>{t('spot.bar.title')}</Text>
      <AvailabilityBar
        domain={domain}
        free={free}
        selection={selection}
        onPick={onPick}
        nowLabel={startsNow ? t('spot.time.now') : undefined}
        dividers={midnights}
      />
      <View style={styles.ticks}>
        {startsNow && (
          <View style={[styles.tick, { left: 0, width: 56, alignItems: 'flex-start' }]}>
            <Text style={styles.tickText}>{t('spot.time.now')}</Text>
          </View>
        )}
        {ticks.map(({ fraction, hour, midnightDateISO }) => {
          const width = midnightDateISO ? DAY_TICK_WIDTH : TICK_WIDTH;
          return (
            <View
              key={`${fraction}`}
              style={[
                styles.tick,
                { width, left: `${fraction * 100}%` },
                fraction === 0 && { alignItems: 'flex-start' },
                fraction === 1 && { marginLeft: -width, alignItems: 'flex-end' },
                fraction > 0 && fraction < 1 && { marginLeft: -width / 2 },
              ]}
            >
              <Text style={[styles.tickText, midnightDateISO ? { fontWeight: '600' } : null]}>
                {midnightDateISO ? formatWeekdayShortDay(midnightDateISO) : hour}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>{t('spot.bar.free')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textSecondary + '33' }]} />
          <Text style={styles.legendText}>{t('spot.bar.busy')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.teal }]} />
          <Text style={styles.legendText}>{t('spot.bar.mine')}</Text>
        </View>
      </View>
    </View>
  );
}
