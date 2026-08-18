import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateProfile } from '@/src/services/authService';

export default function OwnerProfileEdit() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;
  const login = useSessionStore((s) => s.login);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  async function save() {
    const updated = await updateProfile(user, { name, email });
    login(updated);
    router.back();
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('profile.edit.title')}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Button title={t('common.save')} onPress={save} />
    </Screen>
  );
}
