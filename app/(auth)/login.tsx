import { t } from '@/src/i18n';
import { useState } from 'react';
import { Text, TextInput, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { loginAsDriver, loginAsOwner } from '@/src/services/authService';

export default function Login() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useSessionStore((s) => s.login);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, justifyContent: 'center' },
    logo: { width: 200, height: 150, alignSelf: 'center', marginBottom: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    link: { color: colors.teal, textAlign: 'center', marginTop: 8 },
  });

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    const isOwner = normalizedEmail === 'propietario@gmail.com';
    const mockUser = isOwner ? await loginAsOwner() : await loginAsDriver();
    const user = { ...mockUser, email: email.trim() || mockUser.email };
    login(user);
    router.replace(isOwner ? '/(owner)/(tabs)' : '/(driver)/(tabs)');
  }

  return (
    <Screen style={styles.container}>
      <Image
        source={require('@/assets/logo-parklink.png')}
        style={styles.logo}
        resizeMode="contain"
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
        placeholder=t('auth.login.placeholder.password')
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title=t('auth.login.button') onPress={handleLogin} />
      <Text style={styles.link} onPress={() => router.push('/(auth)/register')}>
        ¿No tenés cuenta? Registrate
      </Text>
      <Text style={styles.link} onPress={() => router.push('/(auth)/forgot-password')}>
        Olvidé mi contraseña
      </Text>
    </Screen>
  );
}
