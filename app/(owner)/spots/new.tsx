import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { createParkingSpot } from '@/src/services/parkingService';

export default function NewSpot() {
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [address, setAddress] = useState('');
  const [covered, setCovered] = useState(true);
  const [price, setPrice] = useState('');
  const [schedule, setSchedule] = useState('');
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    if (!user || !address.trim() || !price.trim()) {
      alert('Por favor completa los campos requeridos');
      return;
    }
    
    try {
      setPublishing(true);
      await createParkingSpot({
        title: address.split(',')[0] || address,
        address: address.trim(),
        covered,
        pricePerHour: Number(price),
        schedule: schedule.trim() || undefined,
        description: description.trim() || undefined,
      });
      router.back();
    } catch (error) {
      alert('Error al publicar la cochera');
      setPublishing(false);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 8 },
    photoBox: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 10,
      height: 90,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    photoPlus: { fontSize: 24, color: colors.textSecondary },
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
    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    toggle: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toggleText: { color: colors.text },
    toggleTextActive: { color: colors.white, fontWeight: '600' },
    button: { marginTop: 16 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.caption}>Fotos</Text>
      <Pressable style={styles.photoBox}>
        <Text style={styles.photoPlus}>+</Text>
        <Text style={typography.caption}>Tocá para subir fotos</Text>
      </Pressable>

      <Text style={typography.caption}>Dirección</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />

      <Text style={typography.caption}>Tipo de cochera</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, covered && styles.toggleActive]}
          onPress={() => setCovered(true)}
        >
          <Text style={covered ? styles.toggleTextActive : styles.toggleText}>Cubierta</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, !covered && styles.toggleActive]}
          onPress={() => setCovered(false)}
        >
          <Text style={!covered ? styles.toggleTextActive : styles.toggleText}>Descubierta</Text>
        </Pressable>
      </View>

      <Text style={typography.caption}>Precio por hora</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        placeholder="$1.200"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.caption}>Disponibilidad</Text>
      <TextInput
        style={styles.input}
        value={schedule}
        onChangeText={setSchedule}
        placeholder="Lun a Vie · 8:00 a 22:00"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.caption}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Cochera amplia para auto mediano. Acceso por portón eléctrico."
        placeholderTextColor={colors.textSecondary}
      />

      <Button title="Publicar cochera" onPress={publish} disabled={publishing} style={styles.button} />
    </Screen>
  );
}
