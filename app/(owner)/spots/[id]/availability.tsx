import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function SpotAvailability() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  if (!spot) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
    dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{spot.title}</Text>
      <Text style={typography.caption}>Horario recurrente: {spot.schedule}</Text>
      {DAYS.map((day) => (
        <Card key={day} style={styles.dayRow}>
          <Text style={typography.body}>{day}</Text>
          <Text style={typography.caption}>Disponible</Text>
        </Card>
      ))}
    </Screen>
  );
}
