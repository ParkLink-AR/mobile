import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stars: { color: colors.warning, fontSize: sc(14) },
    value: { color: colors.textSecondary, fontSize: sc(13) },
  });
  return (
    <View style={styles.row}>
      <Text style={styles.stars}>{'★'.repeat(Math.round(rating))}</Text>
      <Text style={styles.value}>
        {rating.toFixed(1)}
        {count !== undefined ? ` · ${count} reseñas` : ''}
      </Text>
    </View>
  );
}
