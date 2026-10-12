import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { formatWeekdayShortDay } from '@/src/services/bookingDates';
import {
  barFractionToMs,
  barSpan,
  endDateOf,
  formatArtTime,
  gapAt,
  startDateOf,
  type Interval,
} from '@/src/services/bookingRange';

const TOOLTIP_MS = 3500;

interface AvailabilityBarProps {
  /** Qué tramo del tiempo dibuja la barra, de punta a punta. */
  domain: Interval;
  /** Lo libre dentro de ese tramo (en verde); lo demás es gris. Va ordenado. */
  free: Interval[];
  /** La reserva elegida (en teal), si cae en este tramo. */
  selection: Interval | null;
  /** Se tocó un tramo verde en este instante. Tocar lo gris no lo llama: muestra desde cuándo hasta cuándo no hay lugar. */
  onPick: (ms: number) => void;
  /** Si el tramo arranca "ahora", cómo rotular ese borde en el aviso de lo no disponible. */
  nowLabel?: string;
  /** Fracciones (0–1) donde dibujar una línea divisoria, p. ej. la medianoche. */
  dividers?: number[];
  barHeight?: number;
  touchHeight?: number;
  /** El aviso sale arriba de la barra (por defecto) o abajo -- en una lista, la primera fila no tiene lugar arriba. */
  tooltipBelow?: boolean;
}

/**
 * Tira de disponibilidad: lo libre en verde, lo no disponible en gris y la reserva elegida en teal. Tocar un tramo verde
 * elige ahí el inicio; tocar uno gris muestra, en un globito, desde cuándo hasta cuándo no está disponible (lo que en
 * una computadora sería pasar el mouse por encima). No dice qué hay en lo gris: una reserva ajena, el horario cerrado y
 * lo ya pasado se ven igual.
 */
export function AvailabilityBar({
  domain,
  free,
  selection,
  onPick,
  nowLabel,
  dividers = [],
  barHeight = 16,
  touchHeight = 40,
  tooltipBelow = false,
}: AvailabilityBarProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  const [tipWidth, setTipWidth] = useState(0);

  // El globito se va solo a los pocos segundos.
  useEffect(() => {
    if (!tip) return;
    const timer = setTimeout(() => setTip(null), TOOLTIP_MS);
    return () => clearTimeout(timer);
  }, [tip]);

  const selectionSpan = selection ? barSpan(selection, domain) : null;
  const referenceDate = startDateOf(domain.startMs);

  function edgeLabel(ms: number, isEnd: boolean): string {
    if (!isEnd && nowLabel && ms === domain.startMs) return nowLabel;
    const date = isEnd ? endDateOf(ms) : startDateOf(ms);
    const time = formatArtTime(ms, isEnd);
    return date === referenceDate ? time : `${formatWeekdayShortDay(date)} ${time}`;
  }

  function handlePress(locationX: number) {
    if (width <= 0) return;
    const ms = barFractionToMs(domain, locationX / width);
    const gap = gapAt(free, domain, ms);
    if (gap) {
      setTip({
        x: locationX,
        text: t('spot.bar.busyRange', { from: edgeLabel(gap.startMs, false), to: edgeLabel(gap.endMs, true) }),
      });
      return;
    }
    setTip(null);
    onPick(ms);
  }

  const tipLeft = Math.min(Math.max((tip?.x ?? 0) - tipWidth / 2, 0), Math.max(width - tipWidth, 0));

  const styles = StyleSheet.create({
    wrapper: { zIndex: tip ? 10 : 0 },
    touch: { height: touchHeight, justifyContent: 'center' },
    track: { height: barHeight, borderRadius: Math.min(barHeight / 2, 8), backgroundColor: colors.textSecondary + '33', overflow: 'hidden' },
    free: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.success },
    selected: {
      position: 'absolute', top: 0, bottom: 0, minWidth: 10, backgroundColor: colors.teal,
      borderRadius: 5, borderWidth: 2, borderColor: colors.surface,
    },
    divider: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: colors.surface },
    tooltip: {
      position: 'absolute',
      [tooltipBelow ? 'top' : 'bottom']: tooltipBelow ? touchHeight - 4 : touchHeight - 2,
      backgroundColor: colors.text,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      maxWidth: '100%',
      opacity: tipWidth > 0 ? 1 : 0,
    },
    tooltipText: { fontSize: sc(12), color: colors.background, fontWeight: '600' },
  });

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.touch}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => handlePress(event.nativeEvent.locationX)}
        accessibilityRole="adjustable"
      >
        {/* pointerEvents none: así locationX es siempre relativo a la barra y no al tramo que se tocó. */}
        <View style={styles.track} pointerEvents="none">
          {free.map((range) => {
            const span = barSpan(range, domain);
            return span ? (
              <View
                key={range.startMs}
                style={[styles.free, { left: `${span.from * 100}%`, width: `${(span.to - span.from) * 100}%` }]}
              />
            ) : null;
          })}
          {dividers.map((fraction) => (
            <View key={fraction} style={[styles.divider, { left: `${fraction * 100}%` }]} />
          ))}
          {selectionSpan && (
            <View
              style={[styles.selected, { left: `${selectionSpan.from * 100}%`, width: `${(selectionSpan.to - selectionSpan.from) * 100}%` }]}
            />
          )}
        </View>
      </Pressable>
      {tip && (
        <View
          style={[styles.tooltip, { left: tipLeft }]}
          pointerEvents="none"
          onLayout={(event) => setTipWidth(event.nativeEvent.layout.width)}
        >
          <Text style={styles.tooltipText}>{tip.text}</Text>
        </View>
      )}
    </View>
  );
}
