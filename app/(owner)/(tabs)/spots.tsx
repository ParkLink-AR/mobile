import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, paddingBottom: 8,
    },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 8, borderWidth: 1.5, borderColor: colors.teal,
    },
    addBtnText: { fontSize: 13, fontWeight: '600', color: colors.teal },
    list: { padding: 16, paddingTop: 8, gap: 12 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    emptyBtn: { alignSelf: 'stretch', marginTop: 8 },
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <View style={styles.header}>
        <Text style={typography.h1}>{t('tabs.owner.spots')}</Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.75 : 1 }]}
          onPress={() => router.push('/(owner)/spots/new')}
        >
          <Ionicons name="add" size={16} color={colors.teal} />
          <Text style={styles.addBtnText}>{t('profile.mySpots.add')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
      ) : spots.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="home-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('profile.mySpots.empty')}</Text>
          <Button
            title={t('profile.mySpots.add')}
            onPress={() => router.push('/(owner)/spots/new')}
            style={styles.emptyBtn}
          />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(owner)/spots/${item.id}`)}>
              <ParkingSpotCard spot={item} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
