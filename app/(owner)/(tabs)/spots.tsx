import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { Button } from '@/src/components/Button';
import { RoleBadge } from '@/src/components/RoleBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function OwnerSpots() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
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
    body: { flex: 1 },
    list: { padding: 16, paddingTop: 8, gap: 12 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    // Franja fija arriba del tab bar -- el botón de agregar vive acá para
    // todas las variantes (lista vacía o con cocheras), así el header de
    // arriba queda siempre igual (título + RoleBadge) en vez de competir por
    // espacio con este botón.
    footer: {
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
  });

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.h1}>{t('tabs.owner.spots')}</Text>
        <RoleBadge />
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
        ) : spots.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="home-outline" size={sc(48)} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('profile.mySpots.empty')}</Text>
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
      </View>

      <View style={styles.footer}>
        <Button title={t('profile.mySpots.add')} onPress={() => router.push(`${group}/spots/new`)} />
      </View>
    </Screen>
  );
}
