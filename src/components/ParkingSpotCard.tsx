import { View, Text, Image, StyleSheet } from 'react-native';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { ParkingSpot } from '@/src/types';

const TAG_ICONS: Record<string, string> = {
  'Cubierta': '🅿️',
  'Descubierta': '☀️',
  'Acceso 24/7': '🕐',
  'Segura': '🛡️',
};

export function ParkingSpotCard({ spot }: { spot: ParkingSpot }) {
  const colors = useThemeColors();
  const typography = useTypography();
  const styles = StyleSheet.create({
    card: { padding: 0, overflow: 'hidden' },
    photo: { width: '100%', height: 130 },
    body: { padding: 12, gap: 4 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    price: { color: colors.teal, fontWeight: '700' },
    description: { ...typography.caption, marginBottom: 2 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 2 },
    tag: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagText: { fontSize: 11, color: colors.text },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  });
  return (
    <Card style={styles.card}>
      <Image source={{ uri: spot.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={typography.h2} numberOfLines={1}>
            {spot.title}
          </Text>
          <Text style={styles.price}>${spot.pricePerHour}/hora</Text>
        </View>
        <Text style={typography.caption} numberOfLines={1}>
          {spot.address}
        </Text>
        <Text style={styles.description} numberOfLines={1}>
          {spot.description}
        </Text>
        <View style={styles.tagRow}>
          {spot.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>
                {TAG_ICONS[tag] ?? ''} {tag}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footerRow}>
          <Text style={typography.caption}>
            ★ {spot.rating.toFixed(1)} ({spot.reviewCount})
          </Text>
          <Text style={typography.caption}>{spot.distanceMeters} m</Text>
        </View>
      </View>
    </Card>
  );
}
