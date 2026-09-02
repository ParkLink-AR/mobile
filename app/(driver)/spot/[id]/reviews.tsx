import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { t, useLanguage } from '@/src/i18n';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { getReviewsForSpot } from '@/src/services/bookingService';
import { ParkingSpot, Review } from '@/src/types';

export default function SpotReviews() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
    getReviewsForSpot(id).then(setReviews);
  }, [id]);

  if (!spot) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    subtitle: { marginBottom: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stars: { color: colors.warning, fontSize: 13 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{spot.title}</Text>
      <Text style={[typography.caption, styles.subtitle]}>
        ★ {spot.rating.toFixed(1)} · {t('spot.reviews.count', { count: spot.reviewCount })}
      </Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('spot.reviews.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={typography.h2}>{item.reviewerName}</Text>
              <Text style={styles.stars}>{'★'.repeat(item.stars)}</Text>
            </View>
            <Text style={typography.body}>{item.comment}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}
