import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getParkingSpotDetail, updateParkingSpot } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function SpotAvailability() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => {
      if (!s) return;
      setSpot(s);
      setStartHour(String(s.scheduleStartHour));
      setEndHour(String(s.scheduleEndHour));
    });
  }, [id]);

  if (!spot) return null;

  async function saveAvailability() {
    if (!startHour.trim() || !endHour.trim()) {
      alert('Por favor completa los horarios');
      return;
    }

    const start = Number(startHour);
    const end = Number(endHour);

    if (start < 0 || start > 23 || end < 0 || end > 23 || start >= end) {
      alert('Ingresa horarios válidos (0-23 y inicio < fin)');
      return;
    }

    try {
      setSaving(true);
      const updated = await updateParkingSpot(id, {
        scheduleStartHour: start,
        scheduleEndHour: end,
      });
      if (updated) setSpot(updated);
      router.back();
    } catch (error) {
      alert('Error al guardar la disponibilidad');
      setSaving(false);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
    card: { paddingVertical: 8 },
    dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      marginBottom: 4,
      color: colors.text,
    },
    timeRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 16 },
    timeInput: { flex: 1 },
    label: { marginBottom: 4 },
  });

  return (
    <Screen style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={typography.h1}>{spot.title}</Text>
        <Text style={[typography.caption, styles.label]}>
          Horario recurrente actual: {spot.schedule}
        </Text>

        <Text style={[typography.caption, styles.label]}>Editar disponibilidad</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeInput}>
            <Text style={[typography.caption, styles.label]}>Desde (hora)</Text>
            <TextInput
              style={styles.input}
              value={startHour}
              onChangeText={setStartHour}
              keyboardType="numeric"
              placeholder="8"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.timeInput}>
            <Text style={[typography.caption, styles.label]}>Hasta (hora)</Text>
            <TextInput
              style={styles.input}
              value={endHour}
              onChangeText={setEndHour}
              keyboardType="numeric"
              placeholder="22"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <Text style={[typography.caption, styles.label]}>Disponibilidad por día</Text>
        {DAYS.map((day) => (
          <Card key={day} style={[styles.card, styles.dayRow]}>
            <Text style={typography.body}>{day}</Text>
            <Text style={typography.caption}>Disponible {startHour}-{endHour}h</Text>
          </Card>
        ))}

        <Button title={saving ? 'Guardando...' : 'Guardar disponibilidad'} onPress={saveAvailability} disabled={saving} />
      </ScrollView>
    </Screen>
  );
}
