import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function EditSpot() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => {
      if (!s) return;
      setSpot(s);
      setPrice(String(s.pricePerHour));
      setDescription(s.description);
    });
  }, [id]);

  if (!spot) return null;

  function save() {
    // Mock only — no update-spot service call in this MVP pass.
    router.back();
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      marginBottom: 4,
      color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{spot.title}</Text>
      <Text style={typography.caption}>Precio por hora</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Text style={typography.caption}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Button title="Guardar cambios" onPress={save} />
    </Screen>
  );
}
