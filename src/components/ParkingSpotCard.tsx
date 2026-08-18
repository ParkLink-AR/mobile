import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { Card } from '@/src/components/Card';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';

// Tag keys stored in mock data mapped to their i18n key and icon
const TAG_KEY_MAP: Record<string, { i18nKey: string; iconName: string }> = {
  'covered':   { i18nKey: 'spot.tag.covered',  iconName: 'car-outline' },
  'uncovered': { i18nKey: 'spot.tag.uncovered', iconName: 'sunny-outline' },
  'access247': { i18nKey: 'spot.tag.access247', iconName: 'time-outline' },
  'secure':    { i18nKey: 'spot.tag.secure',    iconName: 'shield-checkmark-outline' },
};

/** Exported so other screens can translate tag keys without icons */
export const TAG_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(TAG_KEY_MAP).map(([k, v]) => [k, v.i18nKey])
);

export function ParkingSpotCard({ spot }: { spot: ParkingSpot }) {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const styles = StyleSheet.create({
    card: { padding: 0, overflow: 'hidden' },
    photo: { width: '100%', height: 148 },
    body: { padding: 14, gap: 6 },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    priceBadge: {
      backgroundColor: colors.teal + '18',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    priceText: {
      color: colors.teal,
      fontWeight: '700',
      fontSize: 14,
    },
    addressText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    tagText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 4,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 13, fontWeight: '600', color: colors.text },
    reviewCountText: { fontSize: 12, color: colors.textSecondary },
    distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    distanceText: { fontSize: 12, color: colors.textSecondary },
  });

  const distanceLabel =
    spot.distanceMeters >= 1000
      ? `${(spot.distanceMeters / 1000).toFixed(1)} km`
      : `${spot.distanceMeters} m`;

  return (
    <Card style={styles.card}>
      <Image source={{ uri: spot.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {spot.title}
          </Text>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>
              ${getDriverVisiblePrice(spot.pricePerHour)}{t('spot.pricePerHour.short')}
            </Text>
          </View>
        </View>

        <Text style={styles.addressText} numberOfLines={1}>
          {spot.address}
        </Text>
        <Text style={styles.description} numberOfLines={1}>
          {spot.descriptionKey ? t(spot.descriptionKey) : spot.description}
        </Text>

        <View style={styles.tagRow}>
          {spot.tags.map((tag) => {
            const entry = TAG_KEY_MAP[tag];
            return (
              <View key={tag} style={styles.tag}>
                {entry && (
                  <Ionicons
                    name={entry.iconName as any}
                    size={12}
                    color={colors.teal}
                  />
                )}
                <Text style={styles.tagText}>
                  {entry ? t(entry.i18nKey) : tag}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>{spot.rating.toFixed(1)}</Text>
            <Text style={styles.reviewCountText}>({spot.reviewCount})</Text>
          </View>
          <View style={styles.distanceRow}>
            <Ionicons name="navigate-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.distanceText}>{distanceLabel}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
