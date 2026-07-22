import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Chip } from '@/src/components/Chip';
import { RatingStars } from '@/src/components/RatingStars';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const DEFAULT_HOURS = 3;

export default function SpotDetail() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  if (!spot) return null;

  const total = spot.pricePerHour * DEFAULT_HOURS;

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
            <Chip key={tag} label={tag} />
          ))}
        </View>
        <Row label="Dirección" value={spot.address} />
        <Row label="Disponible" value={spot.schedule} />
        <Row label="Precio" value={`$${spot.pricePerHour} por hora`} />
        <Text style={styles.total}>Total ({DEFAULT_HOURS} hs): ${total}</Text>
        <Button
          title="Reservar ahora"
          onPress={() =>
            router.push({
              pathname: '/(driver)/booking/confirm',
              params: { spotId: spot.id, hours: String(DEFAULT_HOURS) },
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
