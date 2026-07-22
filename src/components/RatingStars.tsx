import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stars: { color: colors.warning, fontSize: 14 },
    value: { color: colors.textSecondary, fontSize: 13 },
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
