import { t } from '@/src/i18n';
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

export default function DriverReview() {
  const colors = useThemeColors();
  const typography = useTypography();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');

  function submit() {
    // Mock only — no review persistence service call in this MVP pass.
    router.back();
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
    starsRow: { flexDirection: 'row', gap: 8 },
    star: { fontSize: 32, color: colors.border },
    starActive: { color: colors.warning },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      minHeight: 80,
      textAlignVertical: 'top',
      color: colors.text,
    },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>Calificar al propietario</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)}>
            <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={t('driver.review.placeholder')}
        placeholderTextColor={colors.textSecondary}
        multiline
        value={comment}
        onChangeText={setComment}
      />
      <Button title="Enviar calificación" onPress={submit} />
    </Screen>
  );
}
