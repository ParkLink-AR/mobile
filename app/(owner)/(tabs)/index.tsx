import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function OwnerHome() {
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
    content: { padding: 16, paddingBottom: 120, gap: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, borderWidth: 1.5, borderColor: colors.teal,
    },
    addBtnText: { fontSize: 12, fontWeight: '600', color: colors.teal },
    emptyCard: {
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      padding: 24, alignItems: 'center', gap: 8,
    },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    spotsGrid: { gap: 12 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
      backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.teal,
    },
    actionBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.teal },
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={typography.h1}>{t('tabs.owner.earnings')}</Text>

        {/* Mis cocheras */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.mySpots')}</Text>
          <View style={styles.sectionLine} />
          <Pressable
            style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => router.push('/(owner)/spots/new')}
          >
            <Ionicons name="add" size={14} color={colors.teal} />
            <Text style={styles.addBtnText}>{t('profile.mySpots.add')}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : spots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="home-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('profile.mySpots.empty')}</Text>
          </View>
        ) : (
          <View style={styles.spotsGrid}>
            {spots.slice(0, 3).map((spot) => (
              <Pressable key={spot.id} onPress={() => router.push(`/(owner)/spots/${spot.id}`)}>
                <ParkingSpotCard spot={spot} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Accesos rápidos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.finances')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push('/(owner)/settlements')}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.teal} />
          <Text style={styles.actionBtnText}>{t('owner.view.settlements')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.teal} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
