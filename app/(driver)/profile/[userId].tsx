import { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { ImageViewerModal } from '@/src/components/ImageViewerModal';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { t, useLanguage } from '@/src/i18n';
import { getPublicProfileApi, PublicProfileApiResponse } from '@/src/api/auth';
import { getUserReviewsApi } from '@/src/api/booking';
import { ReportButton } from '@/src/components/ReportButton';
import { useSessionStore } from '@/src/store/useSessionStore';

interface ProfileReviewItem {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment?: string;
}

export default function PublicProfile() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const { userId, as } = useLocalSearchParams<{ userId: string; as: 'owner' | 'driver' }>();
  const [profile, setProfile] = useState<PublicProfileApiResponse | null>(null);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [reviews, setReviews] = useState<ProfileReviewItem[]>([]);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const myId = useSessionStore((s) => s.user?.id);
  // Which side's reviews are shown: the one the viewer came for (`as`), unless they switched to
  // the other one from the small link under the rating.
  const [roleOverride, setRoleOverride] = useState<'owner' | 'driver' | null>(null);
  const role = roleOverride ?? as;
  const otherRole = role === 'owner' ? 'driver' : 'owner';
  // The other side's rating, for that link -- it only shows if there are reviews to see there.
  const [otherSide, setOtherSide] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    getPublicProfileApi(userId).then(setProfile);
  }, [userId]);

  useEffect(() => {
    if (!userId || !otherRole) return;
    getUserReviewsApi(userId, otherRole)
      .then((res) => setOtherSide({ average: res.average_rating, count: res.count }))
      .catch(() => setOtherSide(null));
  }, [userId, otherRole]);

  useEffect(() => {
    if (!userId || !role) return;
    getUserReviewsApi(userId, role).then(async (res) => {
      setAverage(res.average_rating);
      setCount(res.count);

      const nameById: Record<string, string> = {};
      await Promise.allSettled(
        [...new Set(res.reviews.map((r) => r.reviewer_id))].map((reviewerId) =>
          getPublicProfileApi(reviewerId).then((p) => {
            nameById[reviewerId] = p.name;
          }),
        ),
      );

      setReviews(
        res.reviews.map((r) => ({
          id: r.id,
          reviewerId: r.reviewer_id,
          reviewerName: nameById[r.reviewer_id] ?? r.reviewer_id,
          rating: r.rating,
          comment: r.comment,
        })),
      );
    });
  }, [userId, role]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
    headerCard: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.border },
    avatarPlaceholder: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: sc(18), fontWeight: '700', color: colors.text },
    memberSince: { fontSize: sc(13), color: colors.textSecondary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    ratingText: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    otherSideLink: { fontSize: sc(13), fontWeight: '600', color: colors.teal, marginTop: 2 },
    sectionLabel: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stars: { color: colors.warning, fontSize: sc(13) },
    reviewSide: { flexDirection: 'row', alignItems: 'center', gap: sc(8) },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
  });

  if (!profile) return null;

  const memberSince = new Date(profile.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Card style={styles.headerCard}>
        {profile.avatar_url ? (
          <Pressable onPress={() => setViewingAvatar(true)} accessibilityRole="imagebutton">
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          </Pressable>
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={sc(36)} color={colors.textSecondary} />
          </View>
        )}
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.memberSince}>{t('profile.public.memberSince', { date: memberSince })}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={sc(15)} color={colors.warning} />
          <Text style={styles.ratingText}>{average.toFixed(1)}</Text>
          <Text style={styles.memberSince}>· {t('spot.reviews.count', { count })}</Text>
        </View>
        {otherSide && otherSide.count > 0 && (
          <Text
            style={styles.otherSideLink}
            onPress={() => {
              setOtherSide(null);
              setRoleOverride(otherRole);
            }}
          >
            {t(`profile.public.seeOther.${otherRole}`, { rating: otherSide.average.toFixed(1), count: otherSide.count })}
          </Text>
        )}
        {myId && myId !== userId && <ReportButton targetType="user" targetId={userId} />}
      </Card>

      <Text style={styles.sectionLabel}>{t(`profile.public.reviewsAs.${role}`)}</Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={reviews.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={sc(40)} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('spot.reviews.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={typography.h2}>{item.reviewerName}</Text>
              <View style={styles.reviewSide}>
                <Text style={styles.stars}>{'★'.repeat(item.rating)}</Text>
                {myId && myId !== item.reviewerId && <ReportButton targetType="review" targetId={item.id} variant="icon" />}
              </View>
            </View>
            {!!item.comment && <Text style={typography.body}>{item.comment}</Text>}
          </Card>
        )}
      />

      <ImageViewerModal
        uri={viewingAvatar ? profile.avatar_url ?? null : null}
        onClose={() => setViewingAvatar(false)}
      />
    </Screen>
  );
}
