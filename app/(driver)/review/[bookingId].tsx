import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';
import { VehiclePlate } from '@/src/components/VehiclePlate';
import { getBookingApi, getBookingReviewsApi, submitReviewApi, ReviewTargetType } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';
import { getPublicProfileApi } from '@/src/api/auth';
import { formatBookingWhen, mapBookingDateRange } from '@/src/services/bookingDates';

interface PendingTarget {
  targetType: ReviewTargetType;
  titleKey: string;
}

/** Who/what is being rated, so the form shows them instead of a bare "Conductor". */
interface ReviewSubject {
  name: string;
  imageUri: string | null;
}

/** The booking being reviewed -- shown once above the rating cards. */
interface ReviewContext {
  when: string;
  vehicle: { plate: string; brand: string; model: string } | null;
  subjects: Partial<Record<ReviewTargetType, ReviewSubject>>;
}

/** Best-effort: a failure here only drops the names/photos, never blocks rating. */
async function loadReviewContext(bookingId: string, role: 'driver' | 'owner'): Promise<ReviewContext | null> {
  try {
    const booking = await getBookingApi(bookingId);
    const spot = await getParkingSpotDetail(booking.parking_spot_id).catch(() => null);
    const counterpartId = role === 'owner' ? booking.user_id : spot?.ownerId;
    const counterpart = counterpartId ? await getPublicProfileApi(counterpartId).catch(() => null) : null;

    const subjects: ReviewContext['subjects'] = {};
    if (role === 'owner' && counterpart) {
      subjects.driver = { name: counterpart.name, imageUri: counterpart.avatar_url };
    }
    if (role === 'driver') {
      if (spot) subjects.spot = { name: spot.title, imageUri: spot.photos[0] ?? null };
      if (counterpart) {
        subjects.owner = { name: counterpart.name, imageUri: counterpart.avatar_url };
      }
    }
    return {
      when: formatBookingWhen(
        mapBookingDateRange(booking.start, booking.end),
        t('driver.booking.timeTo'),
        t('spot.stay.checkIn'),
        t('spot.stay.checkOut'),
      ),
      vehicle: booking.vehicle ? { plate: booking.vehicle.plate, brand: booking.vehicle.brand, model: booking.vehicle.model } : null,
      subjects,
    };
  } catch {
    return null;
  }
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
  const [context, setContext] = useState<ReviewContext | null>(null);

  useEffect(() => {
    if (!bookingId || !role || !user) return;

    loadReviewContext(bookingId, role).then(setContext);
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
      context={context}
      onSubmitted={(targetTypes) => {
        setSubmittedTargets((prev) => [...prev, ...targetTypes]);
        // Drop the "calificá…" notification right away instead of on the next poll.
        if (user) useNotificationsStore.getState().refresh(user.id);
      }}
    />
  );
}

function ReviewForm({
  bookingId,
  targets,
  context,
  onSubmitted,
}: {
  bookingId: string;
  targets: PendingTarget[];
  context: ReviewContext | null;
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
    bookingSummary: { gap: 8 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
    vehicleText: { fontSize: 13, color: colors.textSecondary },
    subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    subjectImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
    subjectImageSquare: { borderRadius: 10 },
    subjectPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    subjectText: { flex: 1, gap: 2 },
    subjectRole: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
    subjectName: { fontSize: 16, fontWeight: '700', color: colors.text },
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
      {context && (
        <Card style={styles.bookingSummary}>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.summaryText}>{context.when}</Text>
          </View>
          {context.vehicle && (
            <View style={styles.summaryRow}>
              <VehiclePlate plate={context.vehicle.plate} size="small" />
              <Text style={styles.vehicleText}>{context.vehicle.brand} {context.vehicle.model}</Text>
            </View>
          )}
        </Card>
      )}
      {targets.map((target) => {
        const { stars, comment } = ratings[target.targetType];
        const subject = context?.subjects[target.targetType];
        const isSpot = target.targetType === 'spot';
        return (
          <Card key={target.targetType} style={styles.card}>
            {subject ? (
              // Deliberately not a link to their profile: you rate from your own experience,
              // without seeing anyone else's reviews first.
              <View style={styles.subjectRow}>
                {subject.imageUri ? (
                  <Image source={{ uri: subject.imageUri }} style={[styles.subjectImage, isSpot && styles.subjectImageSquare]} />
                ) : (
                  <View style={[styles.subjectImage, styles.subjectPlaceholder, isSpot && styles.subjectImageSquare]}>
                    <Ionicons name={isSpot ? 'car-outline' : 'person'} size={22} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.subjectText}>
                  <Text style={styles.subjectRole}>{t(target.titleKey)}</Text>
                  <Text style={styles.subjectName} numberOfLines={2}>{subject.name}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.blockTitle}>{t(target.titleKey)}</Text>
            )}
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
