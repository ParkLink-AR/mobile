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
      <Screen style={styles.container}>
        <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const remaining = pendingTargets.filter((target) => !submittedTargets.includes(target.targetType));

  if (remaining.length === 0) {
    return (
      <Screen style={{ ...styles.container, ...styles.emptyContainer }}>
        <StatusIcon variant="success" />
        <Text style={typography.h2}>{t('review.allDone')}</Text>
        <Button title={t('common.close')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {pendingTargets.map((target) =>
        submittedTargets.includes(target.targetType) ? null : (
          <ReviewBlock
            key={target.targetType}
            bookingId={bookingId}
            targetType={target.targetType}
            title={t(target.titleKey)}
            onSubmitted={() => setSubmittedTargets((prev) => [...prev, target.targetType])}
          />
        ),
      )}
    </Screen>
  );
}

function ReviewBlock({
  bookingId,
  targetType,
  title,
  onSubmitted,
}: {
  bookingId: string;
  targetType: ReviewTargetType;
  title: string;
  onSubmitted: () => void;
}) {
  const colors = useThemeColors();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = StyleSheet.create({
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

  async function submit() {
    setSubmitting(true);
    try {
      await submitReviewApi(bookingId, targetType, stars, comment.trim() || undefined);
      onSubmitted();
    } catch {
      alert(t('review.errorSubmit'));
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)}>
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
        onChangeText={setComment}
      />
      <Button title={submitting ? t('review.submitting') : t('driver.review.submit')} onPress={submit} disabled={submitting} />
    </Card>
  );
}
