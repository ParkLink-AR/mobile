import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect, useSegments } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { PhotoGallery } from '@/src/components/PhotoGallery';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { getParkingSpotDetail, formatScheduleForDisplay } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

export default function SpotDetail() {
  const colors = useThemeColors();
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);

  useFocusEffect(
    useCallback(() => {
      getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
    }, [id]),
  );

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },

    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 26,
      paddingBottom: 18,
      gap: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    titleBlock: { flex: 1, gap: 4 },
    spotTitle: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    // location-outline's pin glyph is inset within its box, leaving it visibly
    // indented vs the flush-left title above -- nudge it back to line up.
    addressIcon: { marginLeft: -2 },
    spotAddress: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 17 },
    priceBadge: {
      backgroundColor: colors.teal + '18',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    priceValue: { fontSize: 16, fontWeight: '700', color: colors.teal },
    divider: { height: 1, backgroundColor: colors.border },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.background,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    },
    pillText: { fontSize: 12.5, fontWeight: '600', color: colors.text },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 8,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    value: { fontSize: 14.5, color: colors.text, lineHeight: 20 },

    availabilityBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: 4, alignSelf: 'flex-start',
      backgroundColor: colors.teal + '14',
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    },
    availabilityLink: { color: colors.teal, fontWeight: '700', fontSize: 13 },

    editBtn: { marginTop: 4 },
  });

  if (!spot) return null;

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PhotoGallery photos={spot.photos} height={260} fallbackUri={spot.photoUrl} />

        <View style={styles.body}>
          {/* Hero: title, address, rating, price and type together */}
          <View style={styles.heroCard}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.spotTitle}>{spot.title}</Text>
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} style={styles.addressIcon} />
                  <Text style={styles.spotAddress} numberOfLines={2}>{spot.address}</Text>
                </View>
              </View>
              {spot.hourlyEnabled && spot.pricePerHour !== null && (
                <View style={styles.priceBadge}>
                  <Text style={styles.priceValue}>${getDriverVisiblePrice(spot.pricePerHour)}{t('spot.pricePerHour.short')}</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.pillText}>{spot.rating.toFixed(1)} ({spot.reviewCount})</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons
                  name={spot.covered ? 'car-outline' : 'sunny-outline'}
                  size={13}
                  color={colors.teal}
                />
                <Text style={styles.pillText}>
                  {spot.covered ? t('spot.tag.covered') : t('spot.tag.uncovered')}
                </Text>
              </View>
            </View>
          </View>

          {spot.hourlyEnabled && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('owner.spot.edit.availability')}</Text>
              </View>
              {formatScheduleForDisplay(spot.schedule).map((line) => (
                <Text key={line.dayRange} style={styles.value}>
                  {line.dayRange}: {line.hours}
                </Text>
              ))}
              <TouchableOpacity
                style={styles.availabilityBtn}
                onPress={() => router.push(`${group}/spots/${id}/availability`)}
              >
                <Text style={styles.availabilityLink}>{t('owner.spots.manageAvailability')}</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.teal} />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`${group}/spots/${id}/requests`)}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="mail-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>{t('owner.spot.requests.link')}</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={13} color={colors.teal} />
            </View>
          </TouchableOpacity>

          {!!spot.description && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('owner.spot.edit.description')}</Text>
              </View>
              <Text style={styles.value}>{spot.description}</Text>
            </View>
          )}

          <Button
            title={t('owner.spot.edit.title')}
            onPress={() => router.push(`${group}/spots/${id}/edit`)}
            style={styles.editBtn}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
