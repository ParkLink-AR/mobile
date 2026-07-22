import { useCallback, useState } from 'react';
import { Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function OwnerSpots() {
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) getParkingSpotsForOwner(user.id).then(setSpots);
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    price: { color: colors.teal, fontWeight: '700', marginTop: 4 },
    availabilityLink: { color: colors.teal, marginTop: 8 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>Mis cocheras</Text>
      <Button title="+ Publicar cochera" onPress={() => router.push('/(owner)/spots/new')} />
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
              <Text style={styles.price}>${item.pricePerHour} por hora</Text>
              <Text
                style={styles.availabilityLink}
                onPress={() => router.push(`/(owner)/spots/${item.id}/availability`)}
              >
                Gestionar disponibilidad
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
