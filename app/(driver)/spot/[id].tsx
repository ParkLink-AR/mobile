import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Chip } from '@/src/components/Chip';
import { TAG_LABEL_KEYS } from '@/src/components/ParkingSpotCard';
import { RatingStars } from '@/src/components/RatingStars';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function SpotDetail() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const { id, startHour, endHour } = useLocalSearchParams<{ id: string; startHour?: string; endHour?: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  if (!spot) return null;

  const start = startHour ? Number(startHour) : 8;
  const end = endHour ? Number(endHour) : 9;
  const reservedHours = Math.max(end - start, 1);
  const visiblePricePerHour = getDriverVisiblePrice(spot.pricePerHour);
  const total = visiblePricePerHour * reservedHours;

  const styles = StyleSheet.create({
    screen: { backgroundColor: colors.surface },
    container: { flex: 1, backgroundColor: colors.surface },
    photo: { width: '100%', height: 200 },
    body: { padding: 16, gap: 10 },
    tagRow: { flexDirection: 'row', marginVertical: 4 },
    row: { marginTop: 6 },
    total: { ...typography.h2, color: colors.teal, marginVertical: 10 },
  });

  return (
    <Screen style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container}>
      <Image source={{ uri: spot.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <Text style={typography.h1}>{spot.title}</Text>
        <TouchableOpacity onPress={() => router.push(`/(driver)/spot/${spot.id}/reviews`)}>
          <RatingStars rating={spot.rating} count={spot.reviewCount} />
        </TouchableOpacity>
        <View style={styles.tagRow}>
          {spot.tags.map((tag) => (
            <Chip key={tag} label={TAG_LABEL_KEYS[tag] ? t(TAG_LABEL_KEYS[tag]) : tag} />
          ))}
        </View>
        {(spot.descriptionKey || spot.description) ? (
          <Row
            label={t('spot.description')}
            value={spot.descriptionKey ? t(spot.descriptionKey) : spot.description}
          />
        ) : null}
        <Row label={t('spot.address')} value={spot.address} />
        <Row label={t('spot.available')} value={spot.schedule} />
        <Row label={t('spot.pricePerHour')} value={t('spot.pricePerHour.withUnit', { price: String(visiblePricePerHour) })} />
        <Text style={styles.total}>{t('spot.total', { hours: String(reservedHours), total: String(total) })}</Text>
        <Button
          title={t('spot.bookNow')}
          onPress={() =>
            router.push({
              pathname: '/(driver)/booking/confirm',
              params: { spotId: spot.id, hours: String(reservedHours) },
            })
          }
        />
      </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const typography = useTypography();
  const styles = StyleSheet.create({ row: { marginTop: 6 } });
  return (
    <View style={styles.row}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}
