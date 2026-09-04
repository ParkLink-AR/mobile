import { View, Text, Image, TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { Card } from '@/src/components/Card';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';

export const FAVORITE_RED = '#FF385C';

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

interface ParkingSpotCardProps {
  spot: ParkingSpot;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  // Trimmed-down layout (no photo, no description/tags) for the map view's
  // selected-spot preview, where screen space is shared with the map itself.
  compact?: boolean;
}

export function ParkingSpotCard({ spot, isFavorite, onToggleFavorite, compact }: ParkingSpotCardProps) {
  const colors = useThemeColors();
  useLanguage();
  const styles = StyleSheet.create({
    card: { padding: 0, overflow: 'hidden' },
    photoWrapper: { position: 'relative' },
    photo: { width: '100%', height: 148 },
    favoriteBtn: {
      position: 'absolute', top: 10, right: 10,
      width: 30, height: 30, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    unavailableOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(60,60,60,0.55)',
      alignItems: 'center', justifyContent: 'center',
    },
    unavailableBadge: {
      backgroundColor: 'rgba(0,0,0,0.65)',
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    },
    unavailableBadgeText: { color: colors.white, fontWeight: '700', fontSize: 13 },
    contentDimmed: { opacity: 0.5 },
    body: { padding: 14, gap: 6 },
    bodyCompact: { padding: 10, gap: 4 },
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

  function handleFavoritePress(e: GestureResponderEvent) {
    // La card se usa envuelta en un TouchableOpacity de navegación (lista de
    // búsqueda/favoritos) -- sin esto, en react-native-web el tap del
    // corazón burbujea y también dispara la navegación.
    e.stopPropagation?.();
    onToggleFavorite?.();
  }

  return (
    <Card style={styles.card}>
      {!compact && (
        <View style={styles.photoWrapper}>
          <Image source={{ uri: spot.photoUrl }} style={styles.photo} />
          {!spot.active && (
            <View style={styles.unavailableOverlay}>
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableBadgeText}>{t('spot.unavailable')}</Text>
              </View>
            </View>
          )}
          {onToggleFavorite && (
            <TouchableOpacity style={styles.favoriteBtn} onPress={handleFavoritePress}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={17}
                color={isFavorite ? FAVORITE_RED : colors.white}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={[styles.body, compact && styles.bodyCompact, !spot.active && styles.contentDimmed]}>
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

        {!compact && (
          <>
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
          </>
        )}

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
