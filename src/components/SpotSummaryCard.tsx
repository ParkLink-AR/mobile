import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { ParkingSpot } from '@/src/types';

interface SpotSummaryRowProps {
  title: string;
  address?: string | null;
  photoUrl?: string | null;
  /** Opens the spot's listing -- shows a chevron. */
  onPress?: () => void;
}

/**
 * A spot at a glance: its cover photo on the left and, in one column beside it, its name
 * and address -- both starting on the same line, instead of an icon pushing the address in
 * from under the name. Bare (no card around it), for screens that put it inside their own.
 */
export function SpotSummaryRow({ title, address, photoUrl, onPress }: SpotSummaryRowProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const size = sc(68);

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    photo: { width: size, height: size, borderRadius: 10, backgroundColor: colors.border },
    placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    info: { flex: 1, gap: 3 },
    title: { fontSize: sc(17), fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
    address: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
  });

  const content = (
    <>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Ionicons name="car-outline" size={sc(26)} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {address ? <Text style={styles.address} numberOfLines={2}>{address}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={sc(18)} color={colors.teal} /> : null}
    </>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

/** Which spot is being booked, at the top of the confirm screens. */
export function SpotSummaryCard({ spot }: { spot: ParkingSpot }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12,
      }}
    >
      <SpotSummaryRow title={spot.title} address={spot.address} photoUrl={spot.photos[0] ?? spot.photoUrl} />
    </View>
  );
}
