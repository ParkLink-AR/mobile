import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingReviewsApi, submitReviewApi, ReviewTargetType } from '@/src/api/booking';

interface PendingTarget {
  targetType: ReviewTargetType;
  titleKey: string;
}

export default function ReviewScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { bookingId, role } = useLocalSearchParams<{ bookingId: string; role: 'driver' | 'owner' }>();
  const user = useSessionStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [pendingTargets, setPendingTargets] = useState<PendingTarget[]>([]);
  const [submittedTargets, setSubmittedTargets] = useState<ReviewTargetType[]>([]);

  useEffect(() => {
    if (!bookingId || !role || !user) return;

    getBookingReviewsApi(bookingId)
      .then((existingReviews) => {
        const alreadyReviewed = new Set(
          existingReviews.filter((r) => r.reviewer_id === user.id).map((r) => r.target_type),
        );

        const candidates: PendingTarget[] =
          role === 'driver'
            ? [
                { targetType: 'spot', titleKey: 'review.spot.title' },
                { targetType: 'owner', titleKey: 'review.owner.title' },
              ]
            : [{ targetType: 'driver', titleKey: 'review.driver.title' }];

        setPendingTargets(candidates.filter((c) => !alreadyReviewed.has(c.targetType)));
      })
      .finally(() => setLoading(false));
  }, [bookingId, role, user?.id]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  });

  if (loading) {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const remaining = pendingTargets.filter((target) => !submittedTargets.includes(target.targetType));

  if (remaining.length === 0) {
    return (
      <Screen style={{ ...styles.container, ...styles.emptyContainer }} edges={['left', 'right', 'bottom']}>
        <StatusIcon variant="success" />
        <Text style={typography.h2}>{t('review.allDone')}</Text>
        <Button title={t('common.close')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <ReviewForm
      bookingId={bookingId}
      targets={remaining}
      onSubmitted={(targetTypes) => setSubmittedTargets((prev) => [...prev, ...targetTypes])}
    />
  );
}

function ReviewForm({
  bookingId,
  targets,
  onSubmitted,
}: {
  bookingId: string;
  targets: PendingTarget[];
  onSubmitted: (targetTypes: ReviewTargetType[]) => void;
}) {
  const colors = useThemeColors();
  const [ratings, setRatings] = useState<Record<string, { stars: number; comment: string }>>(() =>
    Object.fromEntries(targets.map((target) => [target.targetType, { stars: 5, comment: '' }])),
  );
  const [submitting, setSubmitting] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
    card: { gap: 10 },
    blockTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    starsRow: { flexDirection: 'row', gap: 8 },
    star: { fontSize: 32, color: colors.border },
    starActive: { color: colors.warning },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      minHeight: 70,
      textAlignVertical: 'top',
      color: colors.text,
    },
  });

  function setStars(targetType: ReviewTargetType, stars: number) {
    setRatings((prev) => ({ ...prev, [targetType]: { ...prev[targetType], stars } }));
  }

  function setComment(targetType: ReviewTargetType, comment: string) {
    setRatings((prev) => ({ ...prev, [targetType]: { ...prev[targetType], comment } }));
  }

  async function submit() {
    setSubmitting(true);
    const results = await Promise.allSettled(
      targets.map((target) => {
        const { stars, comment } = ratings[target.targetType];
        return submitReviewApi(bookingId, target.targetType, stars, comment.trim() || undefined).then(
          () => target.targetType,
        );
      }),
    );

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<ReviewTargetType> => r.status === 'fulfilled')
      .map((r) => r.value);

    if (succeeded.length > 0) onSubmitted(succeeded);
    if (succeeded.length < targets.length) {
      alert(t('review.errorSubmit'));
      setSubmitting(false);
    }
  }

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      {targets.map((target) => {
        const { stars, comment } = ratings[target.targetType];
        return (
          <Card key={target.targetType} style={styles.card}>
            <Text style={styles.blockTitle}>{t(target.titleKey)}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setStars(target.targetType, n)}>
                  <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t('driver.review.placeholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={comment}
              onChangeText={(text) => setComment(target.targetType, text)}
            />
          </Card>
        );
      })}
      <Button
        title={submitting ? t('review.submitting') : t('driver.review.submit')}
        onPress={submit}
        disabled={submitting}
      />
    </Screen>
  );
}
