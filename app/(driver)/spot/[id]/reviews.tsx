import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { t, useLanguage } from '@/src/i18n';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { getSpotReviewsApi } from '@/src/api/parking';
import { getPublicProfileApi } from '@/src/api/auth';
import { ParkingSpot } from '@/src/types';

interface SpotReviewItem {
  id: string;
  reviewerName: string;
  rating: number;
  comment?: string;
}

export default function SpotReviews() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [reviews, setReviews] = useState<SpotReviewItem[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  // The list says "no reviews" only once it's actually loaded -- not while the reviewers'
  // names are still being looked up.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
    getSpotReviewsApi(id).then(async (res) => {
      setAverage(res.average_rating);
      setCount(res.count);

      const nameById: Record<string, string> = {};
      await Promise.allSettled(
        [...new Set(res.reviews.map((r) => r.reviewer_id))].map((reviewerId) =>
          getPublicProfileApi(reviewerId).then((profile) => {
            nameById[reviewerId] = profile.name;
          }),
        ),
      );

      setReviews(
        res.reviews.map((r) => ({
          id: r.id,
          reviewerName: nameById[r.reviewer_id] ?? r.reviewer_id,
          rating: r.rating,
          comment: r.comment,
        })),
      );
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [id]);

  if (!spot) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
    subtitle: { marginBottom: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stars: { color: colors.warning, fontSize: sc(13) },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{spot.title}</Text>
      <Text style={[typography.caption, styles.subtitle]}>
        ★ {average.toFixed(1)} · {t('spot.reviews.count', { count })}
      </Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={reviews.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={sc(40)} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{t('spot.reviews.empty')}</Text>
            </View>
          ) : (
            <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
          )
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={typography.h2}>{item.reviewerName}</Text>
              <Text style={styles.stars}>{'★'.repeat(item.rating)}</Text>
            </View>
            {!!item.comment && <Text style={typography.body}>{item.comment}</Text>}
          </Card>
        )}
      />
    </Screen>
  );
}
