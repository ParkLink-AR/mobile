import { useCallback, useEffect } from 'react';
import { Text, View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useOwnerSpotsStore } from '@/src/store/useOwnerSpotsStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { t, useLanguage } from '@/src/i18n';

export default function OwnerSpots() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const spots = useOwnerSpotsStore((s) => s.spots);
  const setSpots = useOwnerSpotsStore((s) => s.setSpots);
  const lastUpdated = useOwnerSpotsStore((s) => s.lastUpdated);

  // Carga inicial y refresco al volver a esta tab desde otra tab
  useFocusEffect(
    useCallback(() => {
      if (user) getParkingSpotsForOwner(user.id).then(setSpots);
    }, [user?.id])
  );

  // Refresco reactivo: cuando edit.tsx llama markUpdated() este efecto
  // corre inmediatamente (aunque la tab no pierda ni recupere el foco),
  // garantizando que los datos se recargan desde el servidor.
  useEffect(() => {
    if (lastUpdated > 0 && user) {
      getParkingSpotsForOwner(user.id).then(setSpots);
    }
  }, [lastUpdated]);

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    price: { color: colors.teal, fontWeight: '700', marginTop: 4 },
    availabilityBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start',
    },
    availabilityLink: { color: colors.teal, fontWeight: '600' },
    chevronBadge: {
      backgroundColor: colors.teal,
      borderRadius: 10,
      width: 20, height: 20,
      alignItems: 'center', justifyContent: 'center',
    },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('owner.spots.title')}</Text>
      <Button title={t('owner.spots.publish')} onPress={() => router.push('/(owner)/spots/new')} />
      <FlatList
        data={spots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(owner)/spots/${item.id}/edit`)}
          >
            <Card>
              <Text style={typography.h2}>{item.title}</Text>
              <Text style={typography.caption}>{item.address}</Text>
              <Text style={styles.price}>{t('owner.spots.pricePerHour', { price: String(item.pricePerHour) })}</Text>
              <TouchableOpacity
                style={styles.availabilityBtn}
                onPress={() => router.push(`/(owner)/spots/${item.id}/availability`)}
              >
                <Text style={styles.availabilityLink}>{t('owner.spots.manageAvailability')}</Text>
                <View style={styles.chevronBadge}>
                  <Ionicons name="chevron-forward" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
