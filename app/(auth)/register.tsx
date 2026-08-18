import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { Text, TextInput, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { loginAsDriver } from '@/src/services/authService';

export default function Register() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useSessionStore((s) => s.login);

  const styles = StyleSheet.create({
    container: { backgroundColor: colors.surface, padding: 24, gap: 12 },
    logo: { width: 120, height: 90, alignSelf: 'center', marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
  });

  async function handleRegister() {
    const user = await loginAsDriver();
    login({ ...user, name: name || user.name, email: email || user.email });
    router.replace('/(driver)/(tabs)');
  }

  return (
    <Screen style={styles.container}>
      <Image
        source={require('@/assets/logo-parklink.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={typography.h1}>{t('auth.register.title')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.register.placeholder.name')}
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.register.placeholder.password')}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={t('auth.register.button')} onPress={handleRegister} />
    </Screen>
  );
}
