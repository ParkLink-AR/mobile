import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { Button } from '@/src/components/Button';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function OwnerSpots() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      getParkingSpotsForOwner(user.id)
        .then(setSpots)
        .finally(() => setLoading(false));
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      padding: 16, paddingBottom: 8,
    },
    list: { padding: 16, paddingTop: 8, gap: 12 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    emptyText: { fontSize: 48, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', lineHeight: 56 },
    emptyBtn: { alignSelf: 'stretch', marginTop: 8, paddingVertical: 10 },
    emptyBtnText: { fontSize: 48, fontWeight: '700', textAlign: 'center' },
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <View style={styles.header}>
        <Text style={typography.h1}>{t('tabs.owner.spots')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
      ) : spots.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="home-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('profile.mySpots.empty')}</Text>
          <Button
            title={t('profile.mySpots.add')}
            onPress={() => router.push(`${group}/spots/new`)}
            style={styles.emptyBtn}
            textStyle={styles.emptyBtnText}
          />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`${group}/spots/${item.id}`)}>
              <ParkingSpotCard spot={item} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
