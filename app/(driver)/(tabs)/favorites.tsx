import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { RoleBadge } from '@/src/components/RoleBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useFavoritesStore } from '@/src/store/useFavoritesStore';
import { getFavoriteSpots } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function Favorites() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      getFavoriteSpots()
        .then(setSpots)
        .catch((err) => console.warn('[Favorites] fetch error:', err))
        .finally(() => setLoading(false));
    }, [user?.id, favoriteIds])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
  });

  if (loading) {
    return (
      <Screen style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={typography.h1}>{t('driver.favorites.title')}</Text>
          <RoleBadge />
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('driver.favorites.title')}</Text>
      <FlatList
        data={spots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={spots.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={sc(40)} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('driver.favorites.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: `/(driver)/spot/${item.id}`,
                params: { startHour: '8', endHour: '9' },
              })
            }
          >
            <ParkingSpotCard
              spot={item}
              isFavorite={favoriteIds.has(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
